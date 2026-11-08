import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  /** Buttons rendered on the right side of the header. */
  actions?: ReactNode
  /** Remove inner padding (e.g. for full-bleed tables). */
  flush?: boolean
}

/** A surface one tone step off the ground: no border, no shadow. */
export function Card({ title, description, actions, flush, className, children, ...props }: CardProps) {
  return (
    <section className={cn('rounded-[20px] bg-card text-card-foreground', className)} {...props}>
      {(title || actions) && (
        <header className={cn('flex flex-wrap items-start justify-between gap-2', flush ? 'px-4 pt-4 pb-3 sm:px-5' : 'px-4 pt-4 sm:px-5 sm:pt-5')}>
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold leading-tight">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-4 sm:p-5', !flush && (title || actions) && 'pt-3 sm:pt-4')}>{children}</div>
    </section>
  )
}

/** Responsive grid: one column on phones, `cols` columns from the sm/md breakpoint. */
export function Grid({ cols = 2, className, children }: { cols?: 1 | 2 | 3 | 4; className?: string; children: ReactNode }) {
  const colClass = {
    1: '',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
  }[cols]
  return <div className={cn('grid gap-4', colClass, className)}>{children}</div>
}

/** Vertical stack with consistent spacing. */
export function Stack({ gap = 4, className, children }: { gap?: 2 | 3 | 4 | 6; className?: string; children: ReactNode }) {
  const gapClass = { 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 6: 'gap-6' }[gap]
  return <div className={cn('flex flex-col', gapClass, className)}>{children}</div>
}

/** Horizontal wrapping row of controls/buttons. */
export function Row({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}
