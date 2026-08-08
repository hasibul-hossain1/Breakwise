import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const AUTOSTART_DIR = join(homedir(), '.config', 'autostart')
const DESKTOP_FILE = join(AUTOSTART_DIR, 'breakwise.desktop')

/**
 * Linux autostart is a freedesktop .desktop file dropped in ~/.config/autostart
 * — `app.setLoginItemSettings` only covers macOS and Windows.
 *
 * Only meaningful for a packaged build: in dev, execPath is the Electron
 * binary, which would relaunch Electron rather than this app.
 */
export function setAutostart(enabled: boolean): void {
  try {
    if (!enabled) {
      rmSync(DESKTOP_FILE, { force: true })
      return
    }

    mkdirSync(AUTOSTART_DIR, { recursive: true })
    const entry = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=Breakwise',
      'Comment=Break reminders for long desk sessions',
      // --autostart keeps the login launch silent; a launch from the app menu
      // has no flag and opens the settings window instead.
      `Exec="${process.execPath}" --autostart`,
      'Icon=breakwise',
      'Terminal=false',
      'X-GNOME-Autostart-enabled=true',
      ''
    ].join('\n')
    writeFileSync(DESKTOP_FILE, entry, 'utf-8')
  } catch (error) {
    console.error('[autostart] failed to update', error)
  }
}
