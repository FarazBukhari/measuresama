import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

const tones: Record<AlertTone, { cls: string; icon: typeof Info }> = {
  info: { cls: 'bg-info-soft text-info-soft-foreground border-info-soft-foreground/20', icon: Info },
  success: { cls: 'bg-success-soft text-success-soft-foreground border-success-soft-foreground/20', icon: CircleCheck },
  warning: { cls: 'bg-warning-soft text-warning-soft-foreground border-warning-soft-foreground/20', icon: TriangleAlert },
  error: { cls: 'bg-destructive-soft text-destructive-soft-foreground border-destructive-soft-foreground/20', icon: CircleAlert },
}

/** Inline message box. Uses an icon + text so meaning never relies on color alone. */
export function Alert({ tone = 'info', title, children, className }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { cls, icon: Icon } = tones[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md border p-3 text-sm', cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 break-words">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
      </div>
    </div>
  )
}
