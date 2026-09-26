import { app, BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import type { BreakPayload, Corner } from '@shared/types'
import { IS_LINUX, IS_MAC } from './platform'

const PRELOAD = join(__dirname, '../preload/index.js')
const RENDERER_DIR = join(__dirname, '../renderer')
const DEV_SERVER = process.env['ELECTRON_RENDERER_URL']

export const OVERLAY_SIZE = { width: 380, height: 136 }
const OVERLAY_MARGIN = 24

/** Resolves a renderer entry in both dev (vite server) and packaged builds. */
function loadRenderer(window: BrowserWindow, page: 'break' | 'settings'): void {
  if (DEV_SERVER) window.loadURL(`${DEV_SERVER}/${page}.html`)
  else window.loadFile(join(RENDERER_DIR, `${page}.html`))
}

/**
 * The window kind the compositor should treat the overlay as. It is not the
 * same word on every platform, and passing a foreign one is not ignored
 * quietly, so each gets its own.
 *
 * Linux: without a type, GNOME treats this as an ordinary application window
 * that opened without focus (we use showInactive), and its focus-stealing
 * prevention posts a "Breakwise is ready" entry in the notification centre
 * every single break. 'notification' tells the compositor it is an overlay,
 * not something you were meant to switch to.
 *
 * macOS: 'panel' backs the window with an NSPanel, which can sit above a
 * fullscreen app and take a click without activating Breakwise and pulling you
 * out of what you were doing.
 *
 * Windows: no equivalent, and none needed — skipTaskbar plus showInactive
 * already keep it out of the way.
 */
const OVERLAY_WINDOW_TYPE = IS_LINUX ? 'notification' : IS_MAC ? 'panel' : undefined

/**
 * Puts a window on every desktop, including over fullscreen apps.
 *
 * skipTransformProcessType matters on macOS: without it this call flips the
 * process between accessory and regular, which shows and hides the Dock icon
 * and can steal focus mid-break. Other platforms ignore the option.
 */
function setVisibleEverywhere(window: BrowserWindow, visible: boolean): void {
  window.setVisibleOnAllWorkspaces(visible, {
    visibleOnFullScreen: visible,
    skipTransformProcessType: true
  })
}

/**
 * Places the overlay in a corner of the display the pointer is on, inside the
 * work area so it never hides under the GNOME top bar, the macOS menu bar, the
 * Windows taskbar, or a dock.
 */
function overlayBounds(position: Corner): { x: number; y: number } {
  const cursor = screen.getCursorScreenPoint()
  const { workArea } = screen.getDisplayNearestPoint(cursor)
  const left = position.includes('left')
  const top = position.includes('top')

  return {
    x: left
      ? workArea.x + OVERLAY_MARGIN
      : workArea.x + workArea.width - OVERLAY_SIZE.width - OVERLAY_MARGIN,
    y: top
      ? workArea.y + OVERLAY_MARGIN
      : workArea.y + workArea.height - OVERLAY_SIZE.height - OVERLAY_MARGIN
  }
}

export function createOverlayWindow(position: Corner): BrowserWindow {
  const { x, y } = overlayBounds(position)

  const window = new BrowserWindow({
    ...OVERLAY_SIZE,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    acceptFirstMouse: true,
    ...(OVERLAY_WINDOW_TYPE ? { type: OVERLAY_WINDOW_TYPE } : {}),
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 'screen-saver' is the highest normal level — it keeps the card above
  // fullscreen editors and video calls, which is the whole point of a reminder.
  window.setAlwaysOnTop(true, 'screen-saver')
  setVisibleEverywhere(window, true)

  loadRenderer(window, 'break')
  return window
}

/** Moves an existing overlay to the configured corner before showing it. */
export function positionOverlay(window: BrowserWindow, position: Corner): void {
  const { x, y } = overlayBounds(position)
  window.setBounds({ ...OVERLAY_SIZE, x, y })
}

/**
 * Shows the overlay without focusing it, so it can never swallow a keystroke
 * while you are mid-sentence in the editor.
 */
export function showOverlay(window: BrowserWindow, payload: BreakPayload): void {
  window.webContents.send('break:start', payload)
  if (!window.isVisible()) window.showInactive()
}

let settingsWindow: BrowserWindow | null = null

export function openSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    // Relaunching must never look like nothing happened. An existing window
    // can be minimised, buried, or sitting on another workspace — so undo all
    // three rather than just calling show().
    if (settingsWindow.isMinimized()) settingsWindow.restore()
    setVisibleEverywhere(settingsWindow, true)
    settingsWindow.show()
    settingsWindow.moveTop()
    // Breakwise runs as an accessory app on macOS (no Dock icon), and an
    // accessory app is not in the activation order — focusing the window alone
    // raises it behind whatever is in front. Activating the app first is what
    // actually brings it forward.
    if (IS_MAC) app.focus({ steal: true })
    settingsWindow.focus()
    setVisibleEverywhere(settingsWindow, false)
    return settingsWindow
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 720,
    minWidth: 520,
    minHeight: 600,
    show: false,
    frame: false,
    resizable: true,
    backgroundColor: '#0d0d10',
    title: 'Breakwise Settings',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show()
    if (IS_MAC) app.focus({ steal: true })
  })
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })

  // Keep external links out of the app window.
  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  loadRenderer(settingsWindow, 'settings')
  return settingsWindow
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null
}
