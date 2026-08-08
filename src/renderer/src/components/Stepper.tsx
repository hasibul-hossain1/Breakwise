interface StepperProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit: string
  label: string
  disabled?: boolean
}

/**
 * Number input with explicit +/- controls. Typing is allowed too, but the
 * buttons mean the common case (nudge by one) never needs the keyboard.
 */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  label,
  disabled = false
}: StepperProps): React.JSX.Element {
  const clamp = (next: number): number => Math.min(max, Math.max(min, next))
  const commit = (next: number): void => {
    if (Number.isFinite(next)) onChange(clamp(next))
  }

  return (
    <div className={`stepper${disabled ? ' disabled' : ''}`}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => commit(value - step)}
        disabled={disabled || value <= min}
      >
        −
      </button>

      <div className="stepper-value">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => commit(Number(event.target.value))}
        />
        <span className="stepper-unit">{unit}</span>
      </div>

      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => commit(value + step)}
        disabled={disabled || value >= max}
      >
        +
      </button>
    </div>
  )
}
