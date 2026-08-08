import type { ReactNode } from 'react'

interface ProgressRingProps {
  /** 0 at the start of the break, 1 when it is over. */
  progress: number
  size: number
  stroke: number
  children?: ReactNode
}

/**
 * A depleting dial. The arc is drawn from 12 o'clock so it reads as a clock
 * face, and `stroke-dashoffset` is transitioned rather than animated per frame
 * so the ring stays smooth on a 100 ms tick.
 */
export function ProgressRing({
  progress,
  size,
  stroke,
  children
}: ProgressRingProps): React.JSX.Element {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, progress))

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            className="ring-track"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            className="ring-progress"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * clamped}
          />
        </g>
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  )
}
