import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface DisclosureProps {
  label: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
  'data-testid'?: string
}

/** "More" section: native <details>, a 52px summary row with a turning chevron, content below. */
export function Disclosure({ label, children, defaultOpen, className, 'data-testid': testId }: DisclosureProps) {
  return (
    <details open={defaultOpen} data-testid={testId} className={cn('group rounded-[20px] bg-card text-card-foreground', className)}>
      <summary className="flex min-h-[52px] list-none items-center justify-between gap-3 rounded-[20px] px-4 font-semibold sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">{label}</span>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </details>
  )
}
