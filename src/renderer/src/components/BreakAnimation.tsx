import type { BreakKind } from '@shared/types'

/**
 * The break-card artwork: a walking figure for body breaks, and a head turning
 * from the screen to the horizon for eye breaks.
 *
 * Inline SVG animated with CSS keyframes (see break.css). This replaced a
 * Lottie implementation: lottie-web builds its parser worker from a `blob:`
 * URL and uses `eval`, both of which the overlay's CSP blocks, and it cost
 * ~690 kB for artwork we generate ourselves. SVG also inherits `currentColor`,
 * so the drawing picks up each break's accent instead of baking it in.
 */

interface BreakAnimationProps {
  kind: BreakKind
  size: number
}

function WalkingFigure(): React.JSX.Element {
  return (
    <svg viewBox="0 0 100 100" className="figure walk" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
        {/* Back limbs sit behind the torso and are dimmed, which is what gives
            the figure depth rather than looking flat. */}
        <g className="limb back-arm">
          <line x1="50" y1="36" x2="50" y2="54" strokeWidth="4" />
        </g>
        <g className="limb back-leg">
          <line x1="50" y1="58" x2="50" y2="84" />
        </g>

        <line x1="50" y1="34" x2="50" y2="58" strokeWidth="5.5" />

        <g className="limb front-leg">
          <line x1="50" y1="58" x2="50" y2="84" />
        </g>
        <g className="limb front-arm">
          <line x1="50" y1="36" x2="50" y2="54" strokeWidth="4" />
        </g>
      </g>
      <circle cx="50" cy="24" r="8.5" fill="currentColor" />
    </svg>
  )
}

function LookingAway(): React.JSX.Element {
  return (
    <svg viewBox="0 0 100 100" className="figure look" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
        <path className="ripple ripple-1" d="M55.2 38.7 A24 24 0 0 1 55.2 61.3" />
        <path className="ripple ripple-2" d="M63.1 34.5 A33 33 0 0 1 63.1 65.5" />
        <path className="ripple ripple-3" d="M71.1 30.3 A42 42 0 0 1 71.1 69.7" />
      </g>

      <circle cx="34" cy="50" r="13" fill="currentColor" />
      {/* The nose is what makes the turn readable, so it starts at the edge of
          the head rather than its centre. */}
      <line
        className="nose"
        x1="34"
        y1="50"
        x2="55"
        y2="50"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function BreakAnimation({ kind, size }: BreakAnimationProps): React.JSX.Element {
  return (
    <div className="art" style={{ width: size, height: size }}>
      {kind === 'body' ? <WalkingFigure /> : <LookingAway />}
    </div>
  )
}
