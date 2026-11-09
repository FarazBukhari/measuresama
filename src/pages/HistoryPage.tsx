import { ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, EmptyState, List } from '../components/ui'
import { EmptyHistoryArt } from '../components/ModeArt'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { ResultSummary } from '../modes/results/ResultSummary'
import { exportCsv, exportJson, historyStore } from '../state/history'
import { unitStore } from '../state/settings'

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
                  <ResultSummary item={item} unit={unit} />
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
