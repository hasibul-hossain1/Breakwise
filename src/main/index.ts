import { app, BrowserWindow, ipcMain } from 'electron'
import type { AppConfig, BreakKind, StatusPayload } from '@shared/types'
import { configStore } from './config'
import { BreakScheduler } from './scheduler'
import { AppTray } from './tray'
import { setAutostart } from './autostart'
import {
  createOverlayWindow,
  getSettingsWindow,
  openSettingsWindow,
  positionOverlay,
  showOverlay
} from './windows'

/**
 * Login autostart passes --autostart so the app can come up silently. A launch
 * without it is a person opening the app, and they need to see something:
 * with no tray icon, the settings window is the only sign the app is alive.
 */
const LAUNCHED_BY_AUTOSTART = process.argv.includes('--autostart')

let overlay: BrowserWindow | null = null
let scheduler: BreakScheduler | null = null
let tray: AppTray | null = null
let quitting = false

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

  if (LAUNCHED_BY_AUTOSTART) {
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

  app.whenReady().then(() => {
    app.setAppUserModelId('dev.shanto.breakwise')
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
