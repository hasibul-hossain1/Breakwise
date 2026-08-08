import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import type { BreakPayload, Corner } from '@shared/types'

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
 * Places the overlay in a corner of the display the pointer is on, inside the
 * work area so it never hides under the GNOME top bar or the dock.
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
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

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
    settingsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    settingsWindow.show()
    settingsWindow.moveTop()
    settingsWindow.focus()
    settingsWindow.setVisibleOnAllWorkspaces(false)
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

  settingsWindow.on('ready-to-show', () => settingsWindow?.show())
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
