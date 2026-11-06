import { ChevronRight, FileJson, FileSpreadsheet, History as HistoryIcon, Ruler } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { MeasurementPhoto } from '../components/MeasurementPhoto'
import { Button, EmptyState } from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatDateTime } from '../lib/format'
import { formatLength } from '../lib/units'
import { MODES } from '../modes/catalog'
import { exportCsv, exportJson, historyStore } from '../state/history'
import { unitStore } from '../state/settings'

const modeName = (id: string) => MODES.find((m) => m.id === id)?.name ?? 'Measurement'

export default function HistoryPage() {
  useDocumentTitle('History')
  const items = historyStore.use()
  const unit = unitStore.use()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">Your saved measurements. They stay on this phone.</p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No measurements yet"
          description="Measurements you take with the camera are saved here, with a photo."
          action={
            <Button icon={Ruler} onClick={() => navigate('/')}>
              Measure something
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-label="Saved measurements">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/history/${item.id}`}
                  data-testid="history-row"
                  className="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-card p-2 pr-3 shadow-xs transition-colors duration-150 hover:bg-muted/60"
                >
                  <MeasurementPhoto uri={item.screenshotUri} alt="" className="size-14 shrink-0 rounded-md" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-mono text-lg font-bold tabular-nums">{formatLength(item.distanceM, unit)}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {[modeName(item.mode), formatDateTime(item.createdAt), item.note].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>

          <section aria-labelledby="export-heading" className="flex flex-col gap-2">
            <h2 id="export-heading" className="text-base font-semibold">
              Export all
            </h2>
            <p className="text-sm text-muted-foreground">Save every measurement as a file for a spreadsheet or a backup.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" icon={FileSpreadsheet} onClick={() => void exportCsv()}>
                Export CSV
              </Button>
              <Button variant="outline" icon={FileJson} onClick={() => void exportJson()}>
                Export JSON
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
