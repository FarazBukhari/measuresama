import { cn } from '../../lib/cn'

/** Brand mark: a tape-measure tape with ruler ticks. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#3730A3" />
      <rect x="5" y="11" width="22" height="10" rx="2" fill="#FBBF24" />
      <path d="M9 11v5M13 11v3M17 11v5M21 11v3M25 11v5" stroke="#1E1B4B" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-foreground">
        Measure <span className="text-primary">Sama</span>
      </span>
    </span>
  )
}
