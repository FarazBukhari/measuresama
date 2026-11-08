import type { LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { cn } from '../lib/cn'

export interface Choice<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

/**
 * Segmented single choice built from real radio inputs, so each option has a proper label
 * (works with screen readers, getByLabel and getByRole('radio')). Pill track, 48px tall (40px small).
 */
export function ChoiceGroup<T extends string>({
  legend,
  value,
  onChange,
  choices,
  hint,
  size = 'md',
  className,
}: {
  legend: string
  value: T
  onChange: (value: T) => void
  choices: readonly Choice<T>[]
  hint?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const name = useId()
  const hintId = `${name}-hint`
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-2', className)} aria-describedby={hint ? hintId : undefined}>
      <legend className="mb-2 text-sm font-semibold text-muted-foreground">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-muted p-1">
        {choices.map((c) => {
          const Icon = c.icon
          return (
            <label
              key={c.value}
              className={cn(
                'relative flex cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-center font-semibold transition-[background-color,color] duration-150',
                size === 'sm' ? 'min-h-11 text-sm' : 'min-h-12 text-base',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                value === c.value ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <input type="radio" name={name} value={c.value} checked={value === c.value} onChange={() => onChange(c.value)} className="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0" />
              {Icon && <Icon className={cn('shrink-0', size === 'sm' ? 'size-4' : 'size-[18px]')} aria-hidden="true" />}
              {c.label}
            </label>
          )
        })}
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </fieldset>
  )
}
