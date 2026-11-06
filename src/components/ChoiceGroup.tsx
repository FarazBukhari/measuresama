import { useId } from 'react'
import { cn } from '../lib/cn'

export interface Choice<T extends string> {
  value: T
  label: string
}

/**
 * Segmented single choice built from real radio inputs, so each option has a proper label
 * (works with screen readers, getByLabel and getByRole('radio')). Targets are 48px tall.
 */
export function ChoiceGroup<T extends string>({
  legend,
  value,
  onChange,
  choices,
  hint,
  className,
}: {
  legend: string
  value: T
  onChange: (value: T) => void
  choices: readonly Choice<T>[]
  hint?: string
  className?: string
}) {
  const name = useId()
  const hintId = `${name}-hint`
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-2', className)} aria-describedby={hint ? hintId : undefined}>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
        {choices.map((c) => (
          <label
            key={c.value}
            className={cn(
              'relative flex min-h-12 cursor-pointer items-center justify-center rounded-md px-2 text-center text-sm font-medium transition-[background-color,color] duration-150',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              value === c.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <input type="radio" name={name} value={c.value} checked={value === c.value} onChange={() => onChange(c.value)} className="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0" />
            {c.label}
          </label>
        ))}
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </fieldset>
  )
}
