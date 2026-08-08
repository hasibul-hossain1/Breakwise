import { app, BrowserWindow, ipcMain } from 'electron'
import type { AppConfig, BreakKind } from '@shared/types'
import { configStore } from './config'
import { BreakScheduler } from './scheduler'
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
let quitting = false

/** Lifecycle tracing, dev builds only — silent once packaged. */
function debug(...args: unknown[]): void {
  if (!app.isPackaged) console.log('[breakwise]', ...args)
}

function broadcast(channel: string, payload: unknown): void {
  getSettingsWindow()?.webContents.send(channel, payload)
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

  scheduler.on('status', (status) => broadcast('status:changed', status))

  configStore.onChange(applyConfig)
  registerIpc()

  setAutostart(config.autostart)
  scheduler.start()

  if (LAUNCHED_BY_AUTOSTART) {
    debug('started silently for autostart; countdown running')
  } else {
    openSettingsWindow()
    debug('started from a manual launch; settings opened')
  }
}

// A second launch should surface settings and restart the countdown rather
// than start a rival instance.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    debug('second launch: before restart', scheduler?.getStatus())
    scheduler?.restart()
    openSettingsWindow()
    debug('second launch: after restart', scheduler?.getStatus())
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('dev.shanto.breakwise')
    bootstrap()
  })
}

// There is no tray: closing the settings window must leave the timer running.
app.on('window-all-closed', () => {
  if (quitting) app.quit()
})

app.on('before-quit', () => {
  quitting = true
  scheduler?.stop()
})
