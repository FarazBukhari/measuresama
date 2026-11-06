import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface FieldProps {
  label?: ReactNode
  /** id of the control the label points to */
  htmlFor?: string
  hint?: ReactNode
  error?: ReactNode
  /** Content shown at the right of the label row (e.g. a copy button or counter). */
  labelAside?: ReactNode
  className?: string
  children: ReactNode
  hintId?: string
  errorId?: string
}

/** Label + control + hint/error wrapper. Errors are shown next to the field. */
export function Field({ label, htmlFor, hint, error, labelAside, className, children, hintId, errorId }: FieldProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {(label || labelAside) && (
        <div className="flex min-h-5 items-end justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
              {label}
            </label>
          )}
          {labelAside && <div className="flex items-center gap-1 text-sm text-muted-foreground">{labelAside}</div>}
        </div>
      )}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export const controlBase =
  'w-full min-w-0 rounded-md border border-input bg-card text-base text-foreground placeholder:text-muted-foreground/70 transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25'
