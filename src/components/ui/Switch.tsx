import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface SwitchProps {
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  description?: ReactNode
  disabled?: boolean
  className?: string
}

/** On/off toggle with a visible label (role="switch"). */
export function Switch({ label, checked, onChange, description, disabled, className }: SwitchProps) {
  const id = useId()
  return (
    <div className={cn('flex min-h-11 items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-base font-semibold">
          {label}
        </label>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-150 disabled:opacity-50',
          checked ? 'bg-foreground' : 'bg-input',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-6 rounded-full bg-background transition-transform duration-150',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}

export interface CheckboxProps {
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  description?: ReactNode
}

/** Native checkbox with a large hit area. */
export function Checkbox({ label, checked, onChange, disabled, className, description }: CheckboxProps) {
  const id = useId()
  return (
    <div className={cn('flex min-h-11 items-start gap-3 py-2', className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 rounded accent-foreground"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold leading-6">
          {label}
        </label>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}
