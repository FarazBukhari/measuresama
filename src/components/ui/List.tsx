import { ChevronRight } from 'lucide-react'
import type { MouseEventHandler, ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '../../lib/cn'

/** A card holding rows split by 1px dividers inset 16px. Children are <ListRow>s (or <li>s). */
export function List({ children, className, 'aria-label': ariaLabel }: { children: ReactNode; className?: string; 'aria-label'?: string }) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn(
        'overflow-hidden rounded-[20px] bg-card text-card-foreground',
        '[&>li]:relative [&>li+li]:before:absolute [&>li+li]:before:inset-x-4 [&>li+li]:before:top-0 [&>li+li]:before:h-px [&>li+li]:before:bg-border',
        className,
      )}
    >
      {children}
    </ul>
  )
}

export interface ListRowProps {
  /** Picture or icon on the left (icons: 20px, muted). */
  leading?: ReactNode
  label: ReactNode
  description?: ReactNode
  /** Value or control on the right. */
  trailing?: ReactNode
  chevron?: boolean
  /** Render the row as a link. */
  to?: string
  /** Render the row as a button (when `to` is not set). A plain 'div' row holds its own controls. */
  as?: 'div' | 'button'
  /** For link and button rows. */
  onClick?: MouseEventHandler<HTMLElement>
  disabled?: boolean
  'aria-label'?: string
  'data-testid'?: string
  className?: string
}

const interactive =
  'transition-colors duration-150 hover:bg-muted/60 active:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50'

/** One row of a List: min 56px, optional leading picture, label, trailing value/control, chevron. */
export function ListRow({ leading, label, description, trailing, chevron, to, as = 'div', onClick, disabled, className, 'aria-label': ariaLabel, 'data-testid': testId }: ListRowProps) {
  const content = (
    <>
      {leading != null && <span className="flex shrink-0 items-center text-muted-foreground [&>svg]:size-5">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="break-words text-base font-semibold">{label}</span>
        {description != null && description !== '' && <span className="break-words text-sm text-muted-foreground">{description}</span>}
      </span>
      {trailing != null && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
      {chevron && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  )
  const base = cn('flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left', className)
  return (
    <li>
      {to !== undefined ? (
        <Link to={to} onClick={onClick} aria-label={ariaLabel} data-testid={testId} className={cn(base, interactive)}>
          {content}
        </Link>
      ) : as === 'button' ? (
        <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} data-testid={testId} className={cn(base, interactive)}>
          {content}
        </button>
      ) : (
        <div data-testid={testId} className={base}>
          {content}
        </div>
      )}
    </li>
  )
}
