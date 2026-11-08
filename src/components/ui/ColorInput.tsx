import { useId, type ReactNode } from 'react'
import { Field, controlBase } from './Field'
import { cn } from '../../lib/cn'

export interface ColorInputProps {
  label?: ReactNode
  /** Hex color like #rrggbb */
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
  error?: ReactNode
  className?: string
}

/** Native color picker paired with an editable hex field. */
export function ColorInput({ label, value, onChange, hint, error, className }: ColorInputProps) {
  const id = useId()
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} errorId={`${id}-error`} className={className}>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={typeof label === 'string' ? `${label} picker` : 'Color picker'}
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-input bg-card p-1"
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(controlBase, 'h-11 px-3 tabular-nums')}
        />
      </div>
    </Field>
  )
}
