/**
 * Dev-only screenshot harness: boots the built renderers with stubbed IPC and
 * writes PNGs of each window, so the UI can be reviewed without a compositor
 * screenshot (GNOME denies those to unprivileged clients).
 *
 * All windows are opened up front and torn down at the end — destroying one
 * and immediately loading the same file:// URL in the next races Electron's
 * loader and fails with ERR_FAILED.
 *
 * Usage: npx electron scripts/capture.cjs [outDir]
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const { writeFileSync, mkdirSync } = require('node:fs')
const { join, resolve } = require('node:path')

const ROOT = resolve(__dirname, '..')
const OUT_DIR = process.argv[2] || join(ROOT, 'shots')
const PRELOAD = join(ROOT, 'out/preload/index.js')
const RENDERER = join(ROOT, 'out/renderer')

const CONFIG = {
  eye: { enabled: true, intervalMinutes: 20, durationSeconds: 20 },
  body: { enabled: true, intervalMinutes: 60, durationSeconds: 300 },
  position: 'top-right',
  autostart: false,
  allowSkip: true
}

const STATUS = {
  paused: false,
  breakActive: false,
  nextEyeMs: 12 * 60_000 + 4000,
  nextBodyMs: 43 * 60_000 + 12_000
}

const WEB_PREFERENCES = {
  preload: PRELOAD,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function stubIpc() {
  ipcMain.handle('config:get', () => CONFIG)
  ipcMain.handle('config:update', () => CONFIG)
  ipcMain.handle('config:reset', () => CONFIG)
  ipcMain.handle('status:get', () => STATUS)
  for (const channel of [
    'break:skip',
    'break:take-now',
    'status:set-paused',
    'settings:close',
    'settings:minimize'
  ]) {
    ipcMain.on(channel, () => {})
  }
}

async function openBreakWindow(kind, remainingSeconds) {
  const window = new BrowserWindow({
    width: 380,
    height: 136,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: WEB_PREFERENCES
  })
  await window.loadFile(join(RENDERER, 'break.html'))
  window.showInactive()

  window.webContents.send('break:start', {
    kind,
    durationSeconds: kind === 'eye' ? 20 : 300,
    // Backdate so the ring shows real progress rather than a full circle.
    endsAt: Date.now() + remainingSeconds * 1000,
    allowSkip: true
  })
  return window
}

async function openSettingsWindow() {
  const window = new BrowserWindow({
    width: 560,
    height: 720,
    show: false,
    frame: false,
    backgroundColor: '#0d0d10',
    webPreferences: WEB_PREFERENCES
  })
  await window.loadFile(join(RENDERER, 'settings.html'))
  window.showInactive()
  return window
}

app.whenReady().then(async () => {
  mkdirSync(OUT_DIR, { recursive: true })
  stubIpc()

  const windows = []
  try {
    windows.push(['break-eye', await openBreakWindow('eye', 14)])
    windows.push(['break-body', await openBreakWindow('body', 272)])
    windows.push(['settings', await openSettingsWindow()])

    // Let fonts settle and entrance animations finish.
    await wait(1200)

    for (const [name, window] of windows) {
      const image = await window.webContents.capturePage()
      writeFileSync(join(OUT_DIR, `${name}.png`), image.toPNG())
      console.log('wrote', `${name}.png`)

      // The settings pane scrolls, so grab the lower half too.
      if (name === 'settings') {
        await window.webContents.executeJavaScript(
          `document.querySelector('.content').scrollTo({ top: 9999 });`
        )
        await wait(400)
        const bottom = await window.webContents.capturePage()
        writeFileSync(join(OUT_DIR, 'settings-bottom.png'), bottom.toPNG())
        console.log('wrote', 'settings-bottom.png')
      }
    }
  } catch (error) {
    console.error('capture failed', error)
    process.exitCode = 1
  } finally {
    for (const [, window] of windows) window.destroy()
    app.quit()
  }
})
