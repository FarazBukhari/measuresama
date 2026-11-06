import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface TabItem<T extends string> {
  id: T
  label: ReactNode
}

export interface TabsProps<T extends string> {
  tabs: readonly TabItem<T>[]
  value: T
  onChange: (id: T) => void
  /** Accessible name of the tab list. */
  label: string
  children?: ReactNode
  className?: string
}

/**
 * Accessible tabs (WAI-ARIA tablist). Render the active panel as `children`;
 * it is wrapped in a tabpanel linked to the active tab.
 */
export function Tabs<T extends string>({ tabs, value, onChange, label, children, className }: TabsProps<T>) {
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = tabs.length - 1
    if (next >= 0) {
      e.preventDefault()
      onChange(tabs[next].id)
      refs.current[next]?.focus()
    }
  }
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border scrollbar-thin">
        {tabs.map((t, i) => {
          const selected = t.id === value
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              id={`${base}-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                '-mb-px h-11 shrink-0 border-b-2 px-3 text-sm font-semibold transition-colors duration-150',
                selected ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${value}`}>
        {children}
      </div>
    </div>
  )
}
