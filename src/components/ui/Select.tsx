import { ChevronDown } from 'lucide-react'
import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { Field, controlBase } from './Field'

export type SelectOption<T extends string = string> = { value: T; label: string; disabled?: boolean } | T

export interface SelectProps<T extends string = string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  value: T
  onChange?: (value: T) => void
  options: readonly SelectOption<T>[]
  /** Optional grouped options: { group: 'Label', options: [...] } */
  groups?: readonly { group: string; options: readonly SelectOption<T>[] }[]
  containerClassName?: string
}

function norm<T extends string>(o: SelectOption<T>) {
  return typeof o === 'string' ? { value: o, label: o, disabled: false } : o
}

/** Native select (best accessibility & mobile pickers) with consistent styling. */
export function Select<T extends string = string>({ label, hint, error, value, onChange, options, groups, containerClassName, className, id, ...props }: SelectProps<T>) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <Field label={label} htmlFor={selectId} hint={hint} error={error} className={containerClassName} errorId={`${selectId}-error`}>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange?.(e.target.value as T)}
          className={cn(controlBase, 'h-11 appearance-none pr-10 pl-3', className)}
          {...props}
        >
          {options.map((o) => {
            const opt = norm(o)
            return (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            )
          })}
          {groups?.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.options.map((o) => {
                const opt = norm(o)
                return (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                )
              })}
            </optgroup>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </div>
    </Field>
  )
}
