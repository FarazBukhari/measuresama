import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { BottomNav } from './BottomNav'
import { Toaster } from './Toaster'

/** Content column + bottom navigation (Home / History / Settings). Each page draws its own PageHeader. */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-[200] rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-[calc(env(safe-area-inset-top)+0.75rem)] focus:left-3"
      >
        Skip to content
      </a>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-[40rem] px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none min-[400px]:px-5 sm:px-6"
      >
        {children}
      </main>
      <BottomNav />
      <Toaster />
    </div>
  )
}
