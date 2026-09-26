import { Menu, nativeImage, nativeTheme, Tray, type NativeImage } from 'electron'
import { execFileSync } from 'node:child_process'
import type { BreakKind, StatusPayload } from '@shared/types'
import { IS_MAC, IS_WINDOWS, resourcePath } from './platform'

export interface TrayActions {
  openSettings: () => void
  takeBreak: (kind: BreakKind) => void
  setPaused: (paused: boolean) => void
  restartTimers: () => void
  quit: () => void
}

/**
 * Minute-resolution labels for the whole tray item.
 *
 * Second resolution meant the tray had to be rewritten every second, which
 * GNOME renders as the icon and any open menu shaking. Nothing here needs to
 * be that precise.
 */
function coarseCountdown(ms: number | null): string {
  if (ms === null) return 'off'
  const minutes = Math.ceil(Math.max(0, ms) / 60_000)
  if (minutes <= 1) return 'under a minute'
  return `${minutes} min`
}

/**
 * Whether the Windows taskbar is currently dark, which decides whether the
 * light or the dark tray mark is legible.
 *
 * Windows tracks the taskbar tone separately from the app tone, and Electron
 * only exposes the app one (`nativeTheme.shouldUseDarkColors`). The two differ
 * whenever someone picks "Custom" in Settings → Personalisation → Colours, and
 * getting it wrong means an invisible tray icon — the only handle this app has
 * — so read the actual value and keep nativeTheme as the fallback.
 */
function windowsTaskbarIsDark(): boolean {
  try {
    const output = execFileSync(
      'reg',
      [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize',
        '/v',
        'SystemUsesLightTheme'
      ],
      { encoding: 'utf-8', windowsHide: true, timeout: 2000 }
    )
    const value = /SystemUsesLightTheme\s+REG_DWORD\s+0x(\d+)/i.exec(output)
    if (value) return value[1] === '0'
  } catch {
    // Key missing (older builds) or reg.exe unavailable — fall through.
  }
  return nativeTheme.shouldUseDarkColors
}

function trayImage(): NativeImage {
  if (IS_MAC) {
    // The @2x variant next to it is picked up automatically. Marking it a
    // template image lets macOS invert and tint it for the menu bar rather
    // than pasting a fixed colour onto it.
    const image = nativeImage.createFromPath(resourcePath('trayTemplate.png'))
    image.setTemplateImage(true)
    return image
  }

  if (IS_WINDOWS) {
    return nativeImage.createFromPath(
      resourcePath(windowsTaskbarIsDark() ? 'tray.ico' : 'tray-dark.ico')
    )
  }

  return nativeImage.createFromPath(resourcePath('tray.png'))
}

export class AppTray {
  private tray: Tray
  private actions: TrayActions
  /** Last rendered menu signature, so we only rebuild when labels change. */
  private signature = ''
  private onThemeChange: (() => void) | null = null

  constructor(actions: TrayActions) {
    this.actions = actions
    this.tray = new Tray(trayImage())
    this.tray.setToolTip('Breakwise')

    // On macOS a left click opens the menu, so an openSettings handler here
    // would fire alongside it. On GNOME the AppIndicator ignores clicks
    // entirely and only opens the menu; on Windows this is the one that
    // matters — a left click opens settings, a right click opens the menu.
    if (!IS_MAC) this.tray.on('click', () => this.actions.openSettings())

    if (IS_WINDOWS) {
      this.onThemeChange = (): void => this.tray.setImage(trayImage())
      nativeTheme.on('updated', this.onThemeChange)
    }
  }

  update(status: StatusPayload): void {
    const eye = coarseCountdown(status.nextEyeMs)
    const body = coarseCountdown(status.nextBodyMs)
    const signature = `${status.paused}|${status.breakActive}|${eye}|${body}`

    // Bail before touching the tray at all when nothing visible changed.
    //
    // Every setToolTip/setContextMenu call is a D-Bus property write on the
    // StatusNotifierItem, and GNOME's AppIndicator extension redraws the icon
    // on each one. The scheduler emits status once a second, so writing on
    // every emit made the icon visibly shake in the top bar. At minute
    // resolution the tray is touched roughly once a minute.
    if (signature === this.signature) return
    this.signature = signature

    this.tray.setToolTip(
      status.paused ? 'Breakwise — paused' : `Breakwise — eyes ${eye}, body ${body}`
    )

    const menu = Menu.buildFromTemplate([
      {
        label: status.paused ? 'Paused' : `Next eye break in ${eye}`,
        enabled: false
      },
      {
        label: `Next body break in ${body}`,
        enabled: false,
        visible: !status.paused
      },
      { type: 'separator' },
      {
        label: 'Take eye break now',
        enabled: !status.breakActive,
        click: () => this.actions.takeBreak('eye')
      },
      {
        label: 'Take body break now',
        enabled: !status.breakActive,
        click: () => this.actions.takeBreak('body')
      },
      { label: 'Restart countdown', click: () => this.actions.restartTimers() },
      { type: 'separator' },
      {
        label: 'Pause reminders',
        type: 'checkbox',
        checked: status.paused,
        click: (item) => this.actions.setPaused(item.checked)
      },
      { label: 'Settings…', click: () => this.actions.openSettings() },
      { type: 'separator' },
      { label: 'Quit Breakwise', click: () => this.actions.quit() }
    ])

    this.tray.setContextMenu(menu)
  }

  destroy(): void {
    if (this.onThemeChange) nativeTheme.off('updated', this.onThemeChange)
    this.tray.destroy()
  }
}
