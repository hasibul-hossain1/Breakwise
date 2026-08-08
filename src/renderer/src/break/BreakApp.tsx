import { useEffect, useMemo, useRef, useState } from 'react'
import type { BreakPayload } from '@shared/types'
import { BREAK_COPY } from '@shared/types'
import { formatDuration } from '@shared/defaults'
import { BreakAnimation } from '../components/BreakAnimation'

/**
 * 100 ms is fast enough that the progress bar reads as continuous (helped by a
 * CSS transition) while re-rendering 10x per second instead of 60x.
 */
const TICK_MS = 100

const ART_SIZE = 72

export function BreakApp(): React.JSX.Element | null {
  const [payload, setPayload] = useState<BreakPayload | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const offStart = window.breakwise.onBreakStart((next) => {
      setPayload(next)
      setLeaving(false)
      setRemainingMs(Math.max(0, next.endsAt - Date.now()))
    })
    const offEnd = window.breakwise.onBreakEnd(() => setLeaving(true))
    return () => {
      offStart()
      offEnd()
    }
  }, [])

  useEffect(() => {
    if (!payload) return undefined

    const update = (): void => setRemainingMs(Math.max(0, payload.endsAt - Date.now()))
    update()
    timerRef.current = window.setInterval(update, TICK_MS)

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [payload])

  const progress = useMemo(() => {
    if (!payload) return 0
    const total = payload.durationSeconds * 1000
    if (total <= 0) return 1
    return Math.min(1, Math.max(0, 1 - remainingMs / total))
  }, [payload, remainingMs])

  if (!payload) return null

  const copy = BREAK_COPY[payload.kind]

  return (
    <div className={`card kind-${payload.kind}${leaving ? ' leaving' : ''}`}>
      <BreakAnimation kind={payload.kind} size={ART_SIZE} />

      <div className="copy">
        <div className="label-row">
          <span className="label">{copy.label}</span>
          {payload.allowSkip && (
            <button
              type="button"
              className="skip"
              onClick={() => window.breakwise.skipBreak()}
              title="End this break early"
            >
              Skip
            </button>
          )}
        </div>

        <div className="headline">{copy.headline}</div>

        <div className="meta">
          <span className="detail">{copy.detail}</span>
          <span className="readout">{formatDuration(remainingMs / 1000)}</span>
        </div>
      </div>

      <div className="progress">
        <div className="progress-fill" style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  )
}
