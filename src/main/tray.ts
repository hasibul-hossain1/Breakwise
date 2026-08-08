import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import type { BreakKind, StatusPayload } from '@shared/types'

export interface TrayActions {
  openSettings: () => void
  takeBreak: (kind: BreakKind) => void
  setPaused: (paused: boolean) => void
  restartTimers: () => void
  quit: () => void
}

function iconPath(file: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, file)
    : join(__dirname, '../../resources', file)
}

function countdown(ms: number | null): string {
  if (ms === null) return 'off'
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export class AppTray {
  private tray: Tray
  private actions: TrayActions
  /** Last rendered menu signature, so we only rebuild when labels change. */
  private signature = ''

  constructor(actions: TrayActions) {
    this.actions = actions
    this.tray = new Tray(nativeImage.createFromPath(iconPath('tray.png')))
    this.tray.setToolTip('Breakwise')
    // Ignored by GNOME's AppIndicator (which only opens the menu), but correct
    // elsewhere and harmless here.
    this.tray.on('click', () => this.actions.openSettings())
  }

  update(status: StatusPayload): void {
    const eye = countdown(status.nextEyeMs)
    const body = countdown(status.nextBodyMs)
    const signature = `${status.paused}|${status.breakActive}|${eye}|${body}`
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
    this.tray.destroy()
  }
}
