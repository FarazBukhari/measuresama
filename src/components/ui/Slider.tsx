import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface SliderProps {
  label: ReactNode
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** How to display the current value next to the label. */
  format?: (value: number) => ReactNode
  hint?: ReactNode
  className?: string
}

/** Range slider with a visible label and value readout. */
export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, format, hint, className }: SliderProps) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-sm tabular-nums text-muted-foreground">
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full accent-primary"
      />
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}
