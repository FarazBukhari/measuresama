import { ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { MeasurementPhoto } from '../components/MeasurementPhoto'
import { EmptyHistoryArt, ModeArt } from '../components/ModeArt'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, EmptyState, List } from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatLength } from '../lib/units'
import { MODES } from '../modes/catalog'
import { exportCsv, exportJson, historyStore } from '../state/history'
import { unitStore } from '../state/settings'

const modeName = (id: string) => MODES.find((m) => m.id === id)?.name ?? 'Measurement'

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

export default function HistoryPage() {
  useDocumentTitle('History')
  const items = historyStore.use()
  const unit = unitStore.use()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col">
      <PageHeader title="History" />

      {items.length === 0 ? (
        <EmptyState
          art={<EmptyHistoryArt className="w-40" />}
          title="No measurements yet"
          action={
            <Button onClick={() => navigate('/')}>
              Measure something
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <List aria-label="Saved measurements">
            {items.map((item) => (
              <li key={item.id}>
                <Link to={`/history/${item.id}`} data-testid="history-row" className="flex min-h-[72px] items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/60 active:bg-muted">
                  <MeasurementPhoto
                    uri={item.screenshotUri}
                    alt=""
                    className="size-12 shrink-0 overflow-hidden rounded-xl"
                    placeholder={<ModeArt id={item.mode} className="size-8" />}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-xl font-bold tabular-nums">{formatLength(item.distanceM, unit)}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {[item.note || modeName(item.mode), shortDate(item.createdAt)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </List>

          <div className="flex items-center gap-2">
            <span className="mr-auto text-sm font-semibold text-muted-foreground">Export all</span>
            <Button variant="secondary" size="sm" aria-label="Export CSV" onClick={() => void exportCsv()}>
              CSV
            </Button>
            <Button variant="secondary" size="sm" aria-label="Export JSON" onClick={() => void exportJson()}>
              JSON
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
