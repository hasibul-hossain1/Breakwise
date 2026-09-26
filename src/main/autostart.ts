import { app } from 'electron'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { IS_LINUX, IS_MAC } from './platform'

const AUTOSTART_DIR = join(homedir(), '.config', 'autostart')
const DESKTOP_FILE = join(AUTOSTART_DIR, 'breakwise.desktop')

/**
 * --autostart keeps the login launch silent; a launch from the app menu, the
 * Dock, or the Start menu has no flag and opens the settings window instead.
 */
export const AUTOSTART_FLAG = '--autostart'

/**
 * Turns "start with my session" on or off.
 *
 * Windows and macOS have a real API for this (`setLoginItemSettings`, which
 * writes a registry Run entry and a Launch Services login item respectively).
 * Linux has none — there it is a freedesktop .desktop file dropped in
 * ~/.config/autostart.
 *
 * Only meaningful for a packaged build: in dev, execPath is the Electron
 * binary, which would relaunch Electron rather than this app.
 */
export function setAutostart(enabled: boolean): void {
  try {
    if (IS_LINUX) setLinuxAutostart(enabled)
    else
      app.setLoginItemSettings({
        openAtLogin: enabled,
        // Ignored since macOS 13, and never meant anything on Windows. Kept
        // for older macOS; `launchedByAutostart` is what actually keeps the
        // login launch quiet.
        openAsHidden: true,
        // Both Windows-only: macOS login items take no arguments, which is
        // why the silent launch is detected after the fact over there.
        path: process.execPath,
        args: [AUTOSTART_FLAG]
      })
  } catch (error) {
    console.error('[autostart] failed to update', error)
  }
}

/**
 * True when this process was started by the login session rather than by a
 * person, and should therefore come up without showing anything.
 */
export function launchedByAutostart(): boolean {
  if (process.argv.includes(AUTOSTART_FLAG)) return true
  // macOS cannot pass the flag, so ask Launch Services after the fact.
  return IS_MAC && app.getLoginItemSettings().wasOpenedAtLogin
}

function setLinuxAutostart(enabled: boolean): void {
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
    `Exec="${process.execPath}" ${AUTOSTART_FLAG}`,
    'Icon=breakwise',
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
  writeFileSync(DESKTOP_FILE, entry, 'utf-8')
}
