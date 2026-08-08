import { EventEmitter } from 'node:events'
import type { AppConfig, BreakKind, BreakPayload, StatusPayload } from '@shared/types'

const TICK_MS = 1000

/**
 * If the wall clock jumps by more than this between ticks the machine was
 * suspended (or the process was starved). We only ever credit this much
 * elapsed time, so closing the lid for lunch does not consume a work interval.
 */
const MAX_CREDITED_DELTA_MS = 5000

interface TimerState {
  remainingMs: number
}

export interface SchedulerEvents {
  'break-start': (payload: BreakPayload) => void
  'break-end': (kind: BreakKind) => void
  status: (status: StatusPayload) => void
}

/**
 * Drives both break timers off a single 1s tick.
 *
 * Countdowns are decremented by measured elapsed time rather than by assuming
 * each tick is exactly 1000 ms, so drift stays bounded even when the event
 * loop is busy.
 */
export class BreakScheduler extends EventEmitter {
  private config: AppConfig
  private timers: Record<BreakKind, TimerState>
  private ticker: NodeJS.Timeout | null = null
  private lastTickAt = Date.now()

  private paused = false
  private activeKind: BreakKind | null = null
  private breakEndsAt = 0

  constructor(config: AppConfig) {
    super()
    this.config = config
    this.timers = {
      eye: this.freshTimer('eye'),
      body: this.freshTimer('body')
    }
  }

  start(): void {
    if (this.ticker) return
    this.lastTickAt = Date.now()
    this.ticker = setInterval(() => this.tick(), TICK_MS)
    this.emitStatus()
  }

  stop(): void {
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = null
  }

  /**
   * Applies new settings. Timers whose interval changed are restarted so the
   * new value takes effect immediately rather than after the current cycle.
   */
  applyConfig(next: AppConfig): void {
    const previous = this.config
    this.config = next

    for (const kind of ['eye', 'body'] as BreakKind[]) {
      const intervalChanged =
        previous[kind].intervalMinutes !== next[kind].intervalMinutes
      const justEnabled = !previous[kind].enabled && next[kind].enabled
      if (intervalChanged || justEnabled) this.timers[kind] = this.freshTimer(kind)
    }
    this.emitStatus()
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return
    this.paused = paused
    if (paused && this.activeKind) this.endBreak()
    this.emitStatus()
  }

  isPaused(): boolean {
    return this.paused
  }

  /** Starts a break immediately, ignoring the countdown. */
  triggerBreak(kind: BreakKind): void {
    if (this.activeKind) return
    this.beginBreak(kind)
  }

  /** Ends the running break early; the next interval starts from now. */
  skipBreak(): void {
    if (this.activeKind) this.endBreak()
  }

  /** Resets both countdowns to a full interval, as on a fresh launch. */
  restart(): void {
    this.timers.eye = this.freshTimer('eye')
    this.timers.body = this.freshTimer('body')
    this.emitStatus()
  }

  private freshTimer(kind: BreakKind): TimerState {
    return { remainingMs: this.config[kind].intervalMinutes * 60_000 }
  }

  private tick(): void {
    const now = Date.now()
    const elapsed = Math.min(now - this.lastTickAt, MAX_CREDITED_DELTA_MS)
    this.lastTickAt = now

    if (this.activeKind) {
      if (now >= this.breakEndsAt) this.endBreak()
      else this.emitStatus()
      return
    }

    if (this.paused) return

    for (const kind of ['eye', 'body'] as BreakKind[]) {
      if (this.config[kind].enabled) this.timers[kind].remainingMs -= elapsed
    }

    // Body breaks win when both come due on the same tick: the longer break
    // rests the eyes too, so firing both back to back would be redundant.
    const due = (['body', 'eye'] as BreakKind[]).find(
      (kind) => this.config[kind].enabled && this.timers[kind].remainingMs <= 0
    )

    if (due) this.beginBreak(due)
    else this.emitStatus()
  }

  private beginBreak(kind: BreakKind): void {
    const durationSeconds = this.config[kind].durationSeconds
    this.activeKind = kind
    this.breakEndsAt = Date.now() + durationSeconds * 1000

    const payload: BreakPayload = {
      kind,
      durationSeconds,
      endsAt: this.breakEndsAt,
      allowSkip: this.config.allowSkip
    }
    this.emit('break-start', payload)
    this.emitStatus()
  }

  private endBreak(): void {
    const kind = this.activeKind
    if (!kind) return
    this.activeKind = null

    this.timers[kind] = this.freshTimer(kind)
    // A body break also rests the eyes, so restart the eye countdown with it.
    if (kind === 'body') this.timers.eye = this.freshTimer('eye')

    this.emit('break-end', kind)
    this.emitStatus()
  }

  getStatus(): StatusPayload {
    return {
      paused: this.paused,
      breakActive: this.activeKind !== null,
      nextEyeMs: this.config.eye.enabled ? Math.max(0, this.timers.eye.remainingMs) : null,
      nextBodyMs: this.config.body.enabled ? Math.max(0, this.timers.body.remainingMs) : null
    }
  }

  private emitStatus(): void {
    this.emit('status', this.getStatus())
  }
}
