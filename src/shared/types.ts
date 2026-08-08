/** Types shared between the main process and both renderers. */

/**
 * `eye` is the 20-20-20 rule: a short, frequent look-away to relax the ciliary
 * muscle. `body` is the longer break for posture, circulation and focus.
 */
export type BreakKind = 'eye' | 'body'

export type Corner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

export interface TimerConfig {
  enabled: boolean
  /** Minutes of work between breaks of this kind. */
  intervalMinutes: number
  /** How long the break itself lasts, in seconds. */
  durationSeconds: number
}

export interface AppConfig {
  eye: TimerConfig
  body: TimerConfig
  position: Corner
  autostart: boolean
  /** Whether the overlay offers a skip button. */
  allowSkip: boolean
}

/** Sent to the overlay renderer when a break begins. */
export interface BreakPayload {
  kind: BreakKind
  durationSeconds: number
  /** Epoch ms when the break ends — the renderer animates against this. */
  endsAt: number
  allowSkip: boolean
}

/** Pushed to the settings window so it can show live state. */
export interface StatusPayload {
  paused: boolean
  breakActive: boolean
  /** Ms until the next break of each kind; null when that timer is disabled. */
  nextEyeMs: number | null
  nextBodyMs: number | null
}

export interface BreakCopy {
  label: string
  headline: string
  detail: string
}

/** Wording for each break kind, shown on the overlay card. */
export const BREAK_COPY: Record<BreakKind, BreakCopy> = {
  eye: {
    label: 'EYE BREAK',
    headline: 'Look away',
    detail: 'Focus ~6 m (20 ft) away'
  },
  body: {
    label: 'BODY BREAK',
    headline: 'Stand up',
    detail: 'Stretch, walk it off'
  }
}
