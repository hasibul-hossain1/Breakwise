import type { AppConfig, Corner, TimerConfig } from './types'

const CORNERS: Corner[] = ['top-right', 'top-left', 'bottom-right', 'bottom-left']

export const DEFAULT_CONFIG: AppConfig = {
  // The 20-20-20 rule: every 20 minutes, look 20 ft away for 20 seconds.
  eye: { enabled: true, intervalMinutes: 20, durationSeconds: 20 },
  body: { enabled: true, intervalMinutes: 60, durationSeconds: 300 },
  position: 'top-right',
  autostart: false,
  allowSkip: true
}

export const LIMITS = {
  intervalMinutes: { min: 1, max: 240 },
  durationSeconds: { min: 5, max: 3600 }
} as const

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

function sanitizeTimer(input: unknown, fallback: TimerConfig): TimerConfig {
  const raw = (input ?? {}) as Partial<TimerConfig>
  return {
    enabled: bool(raw.enabled, fallback.enabled),
    intervalMinutes: clamp(
      num(raw.intervalMinutes, fallback.intervalMinutes),
      LIMITS.intervalMinutes.min,
      LIMITS.intervalMinutes.max
    ),
    durationSeconds: clamp(
      num(raw.durationSeconds, fallback.durationSeconds),
      LIMITS.durationSeconds.min,
      LIMITS.durationSeconds.max
    )
  }
}

/**
 * Coerces anything (a hand-edited config file, a partial IPC patch) into a
 * valid config. Never throws — bad values fall back to the defaults.
 */
export function sanitizeConfig(input: unknown): AppConfig {
  const raw = (input ?? {}) as Partial<AppConfig>
  const position = CORNERS.includes(raw.position as Corner)
    ? (raw.position as Corner)
    : DEFAULT_CONFIG.position

  return {
    eye: sanitizeTimer(raw.eye, DEFAULT_CONFIG.eye),
    body: sanitizeTimer(raw.body, DEFAULT_CONFIG.body),
    position,
    autostart: bool(raw.autostart, DEFAULT_CONFIG.autostart),
    allowSkip: bool(raw.allowSkip, DEFAULT_CONFIG.allowSkip)
  }
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const minutes = Math.floor(s / 60)
  const seconds = s % 60
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : String(seconds)
}
