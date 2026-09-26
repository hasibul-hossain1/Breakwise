import { app } from 'electron'
import { join } from 'node:path'

export const IS_MAC = process.platform === 'darwin'
export const IS_WINDOWS = process.platform === 'win32'
export const IS_LINUX = process.platform === 'linux'

/**
 * Resolves a file shipped in `extraResources`, which lands next to the asar in
 * a packaged build and in `resources/` when running from source.
 */
export function resourcePath(file: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, file)
    : join(__dirname, '../../resources', file)
}
