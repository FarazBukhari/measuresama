import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { dismissToast, toastStore } from '../../state/toast'

const icons = { success: CircleCheck, error: CircleAlert, info: Info }

/** Toast stack (bottom center on phones, bottom right on desktop). */
export function Toaster() {
  const toasts = toastStore.use()
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => {
        const Icon = icons[t.tone]
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex max-w-sm animate-slide-up items-center gap-2.5 rounded-lg border border-border bg-foreground py-2.5 pr-2 pl-3.5 text-sm font-medium text-background shadow-lg"
          >
            <Icon className={cn('size-4 shrink-0', t.tone === 'error' ? 'text-red-400' : t.tone === 'success' ? 'text-emerald-400 dark:text-emerald-700' : '')} aria-hidden="true" />
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  dismissToast(t.id)
                }}
                className="min-h-8 shrink-0 rounded-md px-2.5 font-semibold text-primary-soft underline-offset-2 hover:underline dark:text-primary-foreground"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="inline-flex size-8 items-center justify-center rounded-md opacity-70 hover:opacity-100">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
