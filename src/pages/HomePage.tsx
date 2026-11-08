import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { ModeArt } from '../components/ModeArt'
import { PageHeader } from '../components/layout/PageHeader'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { cn } from '../lib/cn'
import { MODES } from '../modes/catalog'

export default function HomePage() {
  useDocumentTitle(undefined)
  const available = MODES.filter((m) => m.status === 'available')
  const soon = MODES.filter((m) => m.status === 'coming-soon')
  const [hero, ...rest] = available
  return (
    <div className="flex flex-col">
      <PageHeader brand title="Measure Sama" />

      <div className="flex flex-col gap-6">
        <ul className="grid grid-cols-2 gap-3" aria-label="Measuring modes">
          {hero && (
            <li className="col-span-2">
              <Link
                to={hero.path!}
                data-testid="mode-card"
                data-status={hero.status}
                className="flex min-h-44 items-center justify-between gap-4 rounded-[20px] bg-primary [--art-tape:var(--color-paper)] p-5 text-primary-foreground transition-colors duration-150 hover:bg-primary-hover"
              >
                <span className="flex min-w-0 flex-1 flex-col justify-between gap-4 self-stretch">
                  <ModeArt id={hero.id} fallback={hero.icon} className="size-24 shrink-0" />
                  <span className="text-2xl font-bold">{hero.name}</span>
                </span>
                <ChevronRight className="size-6 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          )}
          {rest.map((m, i) => {
            const wide = i === rest.length - 1 && rest.length % 2 === 1
            return (
              <li key={m.id} className={cn(wide && 'col-span-2')}>
                <Link
                  to={m.path!}
                  data-testid="mode-card"
                  data-status={m.status}
                  className={cn(
                    'flex h-full min-h-28 gap-3 rounded-[20px] bg-card p-4 text-card-foreground transition-colors duration-150 hover:bg-muted',
                    wide ? 'flex-row items-center' : 'flex-col justify-between',
                  )}
                >
                  <ModeArt id={m.id} fallback={m.icon} className="size-14 shrink-0" />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="text-base font-bold">{m.name}</span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>

        {soon.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 id="soon-heading" className="text-sm font-semibold text-muted-foreground">
              Coming soon
            </h2>
            <ul className="flex flex-wrap gap-2" aria-labelledby="soon-heading">
              {soon.map((m) => (
                <li key={m.id}>
                  <div data-testid="mode-card" data-status={m.status} className="flex min-h-11 items-center gap-2 rounded-full bg-card py-1 pr-4 pl-2">
                    <ModeArt id={m.id} fallback={m.icon} className="size-7 shrink-0" />
                    <span className="text-sm font-semibold text-muted-foreground">{m.name}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
