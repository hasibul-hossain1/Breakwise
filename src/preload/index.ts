import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, BreakKind, BreakPayload, StatusPayload } from '@shared/types'

/**
 * The only bridge between the renderers and the main process.
 *
 * Nothing from Node is exposed — just this fixed set of calls — so a bug (or
 * anything injected into a renderer) cannot reach the filesystem or spawn
 * processes. Renderers run with contextIsolation on and nodeIntegration off.
 */
const api = {
  // --- environment ----------------------------------------------------------
  // The UI needs it only to name things the way the host OS does — "menu bar"
  // on macOS, "notification area" on Windows, "top bar" on GNOME.
  platform: process.platform,

  // --- config -------------------------------------------------------------
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),
  updateConfig: (patch: Partial<AppConfig>): Promise<AppConfig> =>
    ipcRenderer.invoke('config:update', patch),
  resetConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:reset'),

  // --- break control ------------------------------------------------------
  skipBreak: (): void => ipcRenderer.send('break:skip'),
  takeBreakNow: (kind: BreakKind): void => ipcRenderer.send('break:take-now', kind),
  setPaused: (paused: boolean): void => ipcRenderer.send('status:set-paused', paused),
  restartTimers: (): void => ipcRenderer.send('timer:restart'),
  getStatus: (): Promise<StatusPayload> => ipcRenderer.invoke('status:get'),

  // --- window control -----------------------------------------------------
  closeSettings: (): void => ipcRenderer.send('settings:close'),
  minimizeSettings: (): void => ipcRenderer.send('settings:minimize'),

  // --- subscriptions ------------------------------------------------------
  onBreakStart: (callback: (payload: BreakPayload) => void): (() => void) => {
    const listener = (_event: unknown, payload: BreakPayload): void => callback(payload)
    ipcRenderer.on('break:start', listener)
    return () => ipcRenderer.removeListener('break:start', listener)
  },
  onBreakEnd: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('break:end', listener)
    return () => ipcRenderer.removeListener('break:end', listener)
  },
  onConfigChanged: (callback: (config: AppConfig) => void): (() => void) => {
    const listener = (_event: unknown, config: AppConfig): void => callback(config)
    ipcRenderer.on('config:changed', listener)
    return () => ipcRenderer.removeListener('config:changed', listener)
  },
  onStatus: (callback: (status: StatusPayload) => void): (() => void) => {
    const listener = (_event: unknown, status: StatusPayload): void => callback(status)
    ipcRenderer.on('status:changed', listener)
    return () => ipcRenderer.removeListener('status:changed', listener)
  }
}

export type BreakwiseApi = typeof api

contextBridge.exposeInMainWorld('breakwise', api)
