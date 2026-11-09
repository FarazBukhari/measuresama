import { Capacitor } from '@capacitor/core'
import { FileText } from 'lucide-react'
import { useState } from 'react'
import { MeasurementPhoto } from '../../components/MeasurementPhoto'
import { Button, Card } from '../../components/ui'
import { formatLength, type LengthUnit } from '../../lib/units'
import type { HistoryItem } from '../../state/history'
import { toast } from '../../state/toast'
import { exportRoomPlanPdf } from '../room-plan/pdf'
import { RoomPlanView } from '../room-plan/RoomPlanView'
import { resultSummary } from './summary'

/** The saved measurement: photo (in the app), the main value big, then a short list of extras. */
export function ResultDetail({ item, unit }: { item: HistoryItem; unit: LengthUnit }) {
  const s = resultSummary(item, unit)
  const other = unit === 'cm' ? 'in' : 'cm'
  return (
    <Card>
      <div className="flex flex-col gap-4">
        {item.screenshotUri && Capacitor.isNativePlatform() && (
          <MeasurementPhoto uri={item.screenshotUri} alt={`Photo of the ${s.main} measurement`} className="max-h-[60vh] w-full rounded-md" />
        )}
        {item.mode === 'room-plan' && <RoomPlanView item={item} unit={unit} className="max-h-[60vh]" />}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">{s.mainLabel}</p>
          {item.mode === 'distance' ? (
            <>
              <p data-testid="length-main" className="font-mono text-4xl font-bold tabular-nums">
                {s.main}
              </p>
              <p data-testid="length-other" className="font-mono text-lg tabular-nums text-muted-foreground">
                {formatLength(item.distanceM, other)}
              </p>
            </>
          ) : (
            <p data-testid="result-main" className="font-mono text-4xl font-bold tabular-nums">
              {s.main}
            </p>
          )}
        </div>
        {s.secondary.length > 0 && (
          <dl data-testid="result-secondary" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-border pt-3">
            {s.secondary.map((l) => (
              <div key={l.label} className="contents">
                <dt className="text-sm text-muted-foreground">{l.label}</dt>
                <dd className="text-right font-mono text-[15px] tabular-nums">{l.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {item.mode === 'room-plan' && <SavePdfButton item={item} unit={unit} />}
      </div>
    </Card>
  )
}

function SavePdfButton({ item, unit }: { item: HistoryItem; unit: LengthUnit }) {
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      await exportRoomPlanPdf(item, unit)
    } catch {
      toast('Could not make the PDF', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outline" icon={FileText} loading={busy} onClick={() => void save()} className="self-start">
      Save PDF
    </Button>
  )
}
