import { app, BrowserWindow, ipcMain } from 'electron'
import type { AppConfig, BreakKind, StatusPayload } from '@shared/types'
import { configStore } from './config'
import { BreakScheduler } from './scheduler'
import { AppTray } from './tray'
import { launchedByAutostart, setAutostart } from './autostart'
import { IS_MAC } from './platform'
import {
  createOverlayWindow,
  getSettingsWindow,
  openSettingsWindow,
  positionOverlay,
  showOverlay
} from './windows'

let overlay: BrowserWindow | null = null
let scheduler: BreakScheduler | null = null
let tray: AppTray | null = null
let quitting = false
/** See the macOS 'activate' handler below. */
let swallowLaunchActivation = false

/** Lifecycle tracing, dev builds only — silent once packaged. */
function debug(...args: unknown[]): void {
  if (!app.isPackaged) console.log('[breakwise]', ...args)
}

function broadcast(channel: string, payload: unknown): void {
  getSettingsWindow()?.webContents.send(channel, payload)
}

function handleStatus(status: StatusPayload): void {
  tray?.update(status)
  broadcast('status:changed', status)
}

function applyConfig(config: AppConfig): void {
  scheduler?.applyConfig(config)
  setAutostart(config.autostart)
  broadcast('config:changed', config)
}

function registerIpc(): void {
  ipcMain.handle('config:get', () => configStore.get())
  ipcMain.handle('config:update', (_event, patch: Partial<AppConfig>) =>
    configStore.update(patch)
  )
  ipcMain.handle('config:reset', () => configStore.reset())
  ipcMain.handle('status:get', () => scheduler?.getStatus())

  ipcMain.on('break:skip', () => scheduler?.skipBreak())
  ipcMain.on('break:take-now', (_event, kind: BreakKind) => scheduler?.triggerBreak(kind))
  ipcMain.on('status:set-paused', (_event, paused: boolean) => scheduler?.setPaused(paused))
  ipcMain.on('timer:restart', () => scheduler?.restart())

  ipcMain.on('settings:close', () => getSettingsWindow()?.close())
  ipcMain.on('settings:minimize', () => getSettingsWindow()?.minimize())
}

function bootstrap(): void {
  const config = configStore.load()

  overlay = createOverlayWindow(config.position)
  scheduler = new BreakScheduler(config)

  scheduler.on('break-start', (payload) => {
    if (!overlay || overlay.isDestroyed()) return
    positionOverlay(overlay, configStore.get().position)
    showOverlay(overlay, payload)
    debug('break-start', payload.kind, `${payload.durationSeconds}s`, overlay.getBounds())
  })

  scheduler.on('break-end', () => {
    overlay?.webContents.send('break:end')
    // Let the exit animation play out before pulling the window.
    setTimeout(() => {
      if (overlay && !overlay.isDestroyed()) overlay.hide()
      debug('break-end: overlay hidden, visible =', overlay?.isVisible())
    }, 320)
  })

  scheduler.on('status', handleStatus)

  tray = new AppTray({
    openSettings: () => openSettingsWindow(),
    takeBreak: (kind) => scheduler?.triggerBreak(kind),
    setPaused: (paused) => scheduler?.setPaused(paused),
    restartTimers: () => scheduler?.restart(),
    quit: () => {
      quitting = true
      app.quit()
    }
  })

  configStore.onChange(applyConfig)
  registerIpc()

  setAutostart(config.autostart)
  scheduler.start()
  tray.update(scheduler.getStatus())

  // A login launch comes up silently. A launch without that marker is a person
  // opening the app, and they need to see something: the settings window is
  // the only confirmation that the app is now running.
  if (launchedByAutostart()) {
    swallowLaunchActivation = IS_MAC
    debug('started silently for autostart; countdown running')
  } else {
    openSettingsWindow()
    debug('started from a manual launch; settings opened')
  }
}

// A second launch surfaces settings rather than starting a rival instance.
// It deliberately does NOT restart the countdown: once the timer is running,
// opening settings to look at it must not throw away the progress. Use
// "Restart countdown" in the tray or settings to reset it on purpose.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    openSettingsWindow()
    debug('second launch: settings raised, countdown untouched', scheduler?.getStatus())
  })

  // macOS routes "open an app that is already running" here rather than to
  // second-instance — Launch Services activates the live process instead of
  // starting another one. Without this, double-clicking Breakwise in Finder
  // while it sits in the menu bar would do nothing at all.
  //
  // The launch itself also emits activate, which for a login launch must not
  // put a window on screen; bootstrap arms the flag to eat exactly that one.
  app.on('activate', () => {
    if (swallowLaunchActivation) {
      swallowLaunchActivation = false
      debug('ignored the launch activation of a silent start')
      return
    }
    openSettingsWindow()
  })

  app.whenReady().then(() => {
    // Windows groups taskbar buttons and notifications by this id; without it
    // a packaged build is filed under "electron.app.Electron".
    app.setAppUserModelId('dev.shanto.breakwise')

    // macOS: run as an accessory app — menu bar item, no Dock icon, no app
    // menu. This is a background reminder, and a Dock tile whose only job is
    // to reopen a settings window is noise. The packaged build declares
    // LSUIElement for the same reason; this covers running from source.
    if (IS_MAC) app.dock?.hide()

    bootstrap()
  })
}

// This is a tray app: closing the settings window must not exit it.
app.on('window-all-closed', () => {
  if (quitting) app.quit()
})

app.on('before-quit', () => {
  quitting = true
  scheduler?.stop()
  tray?.destroy()
})
