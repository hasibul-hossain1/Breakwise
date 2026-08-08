import { useEffect, useMemo, useRef, useState } from 'react'
import type { BreakPayload } from '@shared/types'
import { BREAK_COPY } from '@shared/types'
import { formatDuration } from '@shared/defaults'
import { ProgressRing } from '../components/ProgressRing'

/**
 * 100 ms is fast enough that the ring reads as continuous (helped by a CSS
 * transition) while re-rendering 10x per second instead of 60x.
 */
const TICK_MS = 100

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
    return 1 - remainingMs / total
  }, [payload, remainingMs])

  if (!payload) return null

  const copy = BREAK_COPY[payload.kind]
  const seconds = remainingMs / 1000
  const readout = formatDuration(seconds)

  return (
    <div className={`card kind-${payload.kind}${leaving ? ' leaving' : ''}`}>
      <ProgressRing progress={progress} size={62} stroke={4}>
        <span className={`readout${readout.length > 3 ? ' readout-compact' : ''}`}>
          {readout}
        </span>
      </ProgressRing>

      <div className="copy">
        <div className="label">{copy.label}</div>
        <div className="headline">{copy.headline}</div>
        <div className="detail">{copy.detail}</div>
      </div>

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
  )
}
