import type { Corner } from '@shared/types'

const CORNERS: { value: Corner; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' }
]

interface CornerPickerProps {
  value: Corner
  onChange: (corner: Corner) => void
}

/**
 * A miniature screen: you pick where the card appears by clicking that corner
 * of the shape, which is faster to read than a dropdown of four strings.
 */
export function CornerPicker({ value, onChange }: CornerPickerProps): React.JSX.Element {
  return (
    <div className="corner-picker" role="radiogroup" aria-label="Overlay position">
      <div className="corner-screen">
        <div className="corner-bar" />
        {CORNERS.map((corner) => (
          <button
            key={corner.value}
            type="button"
            role="radio"
            aria-checked={value === corner.value}
            aria-label={corner.label}
            title={corner.label}
            className={`corner-slot ${corner.value}${value === corner.value ? ' active' : ''}`}
            onClick={() => onChange(corner.value)}
          >
            <span className="corner-chip" />
          </button>
        ))}
      </div>
    </div>
  )
}
