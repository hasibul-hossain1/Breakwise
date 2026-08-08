import { useEffect, useState } from 'react'
import Lottie from 'lottie-react'
import type { BreakKind } from '@shared/types'
import bodyWalk from '../animations/body-walk.json'
import eyeLook from '../animations/eye-look.json'

/**
 * Swap either JSON for a professionally made animation (lottiefiles.com, or
 * anything exported from After Effects) and nothing else needs to change —
 * just keep the 100x100 canvas so it lands in the same box.
 */
const SOURCES: Record<BreakKind, unknown> = {
  eye: eyeLook,
  body: bodyWalk
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

interface BreakAnimationProps {
  kind: BreakKind
  size: number
}

export function BreakAnimation({ kind, size }: BreakAnimationProps): React.JSX.Element {
  const reduced = usePrefersReducedMotion()

  return (
    <div className="art" style={{ width: size, height: size }} aria-hidden="true">
      <Lottie
        // Remounting on kind change avoids lottie-web reusing the previous
        // animation's frame state.
        key={kind}
        animationData={SOURCES[kind]}
        loop
        // Reduced motion still gets the artwork, just held on its first frame.
        autoplay={!reduced}
        style={{ width: size, height: size }}
        rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
      />
    </div>
  )
}
