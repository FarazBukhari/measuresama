import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { CopyButton } from './CopyButton'

export interface StatProps {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  /** Highlight as the primary result. */
  emphasis?: boolean
  copyValue?: string
  className?: string
}

/** A labelled result number. Use `emphasis` for the main answer of a calculator. */
export function Stat({ label, value, hint, emphasis, copyValue, className }: StatProps) {
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col gap-1 rounded-xl p-4',
        emphasis ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-subtle',
        className,
      )}
    >
      <span className={cn('text-sm font-semibold', copyValue && 'pr-9', emphasis ? 'text-primary-soft-foreground' : 'text-muted-foreground')}>{label}</span>
      <span className={cn('break-words font-extrabold tabular-nums leading-tight tracking-tight', emphasis ? 'text-[28px]' : 'text-xl text-foreground')} aria-live="polite">
        {value}
      </span>
      {hint && <span className={cn('text-sm', emphasis ? 'text-primary-soft-foreground/90' : 'text-muted-foreground')}>{hint}</span>}
      {copyValue && (
        <div className="absolute top-2 right-2">
          <CopyButton value={copyValue} />
        </div>
      )}
    </div>
  )
}

/** Responsive grid of Stat cards. */
export function StatGrid({ children, cols = 3, className }: { children: ReactNode; cols?: 2 | 3 | 4; className?: string }) {
  const c = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' }[cols]
  return <div className={cn('grid gap-3', c, className)}>{children}</div>
}
