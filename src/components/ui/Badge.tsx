import { Check, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'tape-warning' | 'tape-success'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary-soft-foreground',
  accent: 'bg-accent-soft text-accent-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  danger: 'bg-destructive-soft text-destructive-soft-foreground',
  info: 'bg-info-soft text-info-soft-foreground',
  // For chips sitting on the yellow tape readout: ink pill, readable in both themes.
  'tape-warning': 'bg-primary-foreground text-primary',
  'tape-success': 'bg-primary-foreground text-white',
}

/** Chip: pill, 24px tall. Beside values only. `icon` adds a leading icon (tape-success shows a check). */
export function Badge({ tone = 'neutral', icon, children, className }: { tone?: BadgeTone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  const Icon = icon ?? (tone === 'tape-success' ? Check : undefined)
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-bold', tones[tone], className)}>
      {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />}
      {children}
    </span>
  )
}
