import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AppConfig } from '@shared/types'
import { DEFAULT_CONFIG, sanitizeConfig } from '@shared/defaults'

type Listener = (config: AppConfig) => void

/**
 * Small JSON-backed settings store in the app's userData directory.
 * Deliberately dependency-free: the config is a dozen scalars, and a
 * hand-edited or corrupt file should degrade to defaults rather than crash.
 */
class ConfigStore {
  private filePath = join(app.getPath('userData'), 'config.json')
  private current: AppConfig = DEFAULT_CONFIG
  private listeners = new Set<Listener>()

  load(): AppConfig {
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      this.current = sanitizeConfig(JSON.parse(raw))
    } catch {
      // Missing or unreadable file: start from defaults and write them out.
      this.current = DEFAULT_CONFIG
      this.persist()
    }
    return this.current
  }

  get(): AppConfig {
    return this.current
  }

  /** Merges a partial patch, sanitises the result, persists, and notifies. */
  update(patch: Partial<AppConfig>): AppConfig {
    this.current = sanitizeConfig({ ...this.current, ...patch })
    this.persist()
    for (const listener of this.listeners) listener(this.current)
    return this.current
  }

  reset(): AppConfig {
    return this.update(DEFAULT_CONFIG)
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private persist(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(this.current, null, 2), 'utf-8')
    } catch (error) {
      console.error('[config] failed to save', error)
    }
  }
}

export const configStore = new ConfigStore()
