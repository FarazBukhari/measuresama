import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { dismissToast, toastStore } from '../../state/toast'

const icons = { success: CircleCheck, error: CircleAlert, info: Info }

/** Toast stack (bottom center on phones, bottom right on desktop). */
export function Toaster() {
  const toasts = toastStore.use()
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => {
        const Icon = icons[t.tone]
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex max-w-sm animate-slide-up items-center gap-2.5 rounded-full bg-foreground py-1.5 pr-1.5 pl-4 text-sm font-semibold text-background shadow-lg"
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  dismissToast(t.id)
                }}
                className="min-h-8 shrink-0 rounded-full px-2.5 font-bold text-background underline underline-offset-2 focus-visible:outline-background"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="inline-flex size-8 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-background">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
