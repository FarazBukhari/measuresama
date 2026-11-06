import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { cn } from '../lib/cn'
import { MODES, type ModeInfo } from '../modes/catalog'

function ModeCardBody({ mode }: { mode: ModeInfo }) {
  const Icon = mode.icon
  const soon = mode.status === 'coming-soon'
  return (
    <>
      <span
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-lg',
          soon ? 'bg-muted text-muted-foreground' : 'bg-primary-soft text-primary-soft-foreground',
        )}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn('text-base font-semibold', soon && 'text-muted-foreground')}>{mode.name}</span>
          {soon && <Badge>Coming soon</Badge>}
        </span>
        <span className="text-sm text-muted-foreground">{mode.description}</span>
      </span>
      {!soon && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  )
}

export default function HomePage() {
  useDocumentTitle(undefined)
  const available = MODES.filter((m) => m.status === 'available')
  const soon = MODES.filter((m) => m.status === 'coming-soon')
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Measure Sama</h1>
        <p className="text-muted-foreground">A free tape measure for your phone. Pick what you want to measure.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Measuring modes">
        {available.map((m) => (
          <li key={m.id}>
            <Link
              to={m.path!}
              data-testid="mode-card"
              data-status={m.status}
              className="flex min-h-24 items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-xs transition-colors duration-150 hover:border-primary/50 hover:bg-primary-soft/40"
            >
              <ModeCardBody mode={m} />
            </Link>
          </li>
        ))}
      </ul>

      {soon.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="soon-heading">
          <h2 id="soon-heading" className="text-lg font-semibold">
            On the way
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {soon.map((m) => (
              <li key={m.id}>
                <div
                  data-testid="mode-card"
                  data-status={m.status}
                  className="flex min-h-24 cursor-not-allowed items-center gap-4 rounded-lg border border-dashed border-border bg-muted/40 p-4"
                >
                  <ModeCardBody mode={m} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
