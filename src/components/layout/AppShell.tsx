import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { BottomNav } from './BottomNav'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { Toaster } from './Toaster'

/** Top bar + content + bottom navigation (Home / History / Settings). */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-[200] rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md safe-top">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-4 sm:px-6">
          <Link to="/" aria-label="Measure Sama home">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none sm:px-6">
        {children}
      </main>
      <BottomNav />
      <Toaster />
    </div>
  )
}
