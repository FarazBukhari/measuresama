import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type SegmentOption<T extends string> = { value: T; label: ReactNode } | T

export interface SegmentedControlProps<T extends string> {
  label?: ReactNode
  value: T
  onChange: (value: T) => void
  options: readonly SegmentOption<T>[]
  size?: 'sm' | 'md'
  className?: string
  fullWidth?: boolean
}

function norm<T extends string>(o: SegmentOption<T>) {
  return typeof o === 'string' ? { value: o, label: o } : o
}

/** Single-choice pill group (radiogroup). Arrow keys move the selection. */
export function SegmentedControl<T extends string>({ label, value, onChange, options, size = 'md', className, fullWidth }: SegmentedControlProps<T>) {
  const labelId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const opts = options.map(norm)
  const hasSelection = opts.some((o) => o.value === value)

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % opts.length
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + opts.length) % opts.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = opts.length - 1
    if (next >= 0) {
      e.preventDefault()
      onChange(opts[next].value)
      refs.current[next]?.focus()
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <span id={labelId} className="text-sm font-semibold text-muted-foreground">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-labelledby={label ? labelId : undefined}
        className={cn('flex flex-wrap gap-1 rounded-full bg-muted p-1', fullWidth ? 'w-full' : 'w-fit max-w-full')}
      >
        {opts.map((o, i) => {
          const selected = o.value === value
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (!hasSelection && i === 0) ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'rounded-full px-4 font-semibold transition-[background-color,color] duration-150',
                size === 'sm' ? 'min-h-8 text-sm' : 'min-h-10 text-base',
                fullWidth && 'flex-1',
                selected ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
