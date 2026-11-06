import { History, House, Settings, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '../../lib/cn'

const ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

/** Bottom navigation: big (56px) targets, above the phone's gesture bar. */
export function BottomNav() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md safe-bottom">
      <ul className="mx-auto grid max-w-3xl grid-cols-3">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 text-xs font-semibold transition-colors duration-150',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex h-7 w-14 items-center justify-center rounded-full', isActive && 'bg-primary-soft')}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
