import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** A pictogram (`art`, or a lucide `icon`), one title line and one action. */
export function EmptyState({
  art,
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  art?: ReactNode
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 px-6 py-10 text-center', className)}>
      {art ?? (Icon && <Icon className="size-12 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />)}
      <p className="text-xl font-bold tracking-tight">{title}</p>
      {description && <p className="-mt-2 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}
