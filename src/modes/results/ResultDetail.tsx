import { Capacitor } from '@capacitor/core'
import { FileText } from 'lucide-react'
import { useState } from 'react'
import { MeasurementPhoto } from '../../components/MeasurementPhoto'
import { Button, TapeReadout } from '../../components/ui'
import { formatLength, type LengthUnit } from '../../lib/units'
import type { HistoryItem } from '../../state/history'
import { toast } from '../../state/toast'
import { exportRoomPlanPdf } from '../room-plan/pdf'
import { RoomPlanView } from '../room-plan/RoomPlanView'
import { resultSummary } from './summary'

/** The saved measurement: photo (in the app), the main value on the tape, then a short list of extras. */
export function ResultDetail({ item, unit }: { item: HistoryItem; unit: LengthUnit }) {
  const s = resultSummary(item, unit)
  const other = unit === 'cm' ? 'in' : 'cm'
  const distance = item.mode === 'distance'
  return (
    <div className="flex flex-col gap-4">
      {item.screenshotUri && Capacitor.isNativePlatform() && (
        <MeasurementPhoto uri={item.screenshotUri} alt={`Photo of the ${s.main} measurement`} className="max-h-[60vh] w-full rounded-[20px]" />
      )}
      {item.mode === 'room-plan' && <RoomPlanView item={item} unit={unit} className="max-h-[60vh] rounded-[20px] bg-card" />}
      <div className="flex flex-col gap-2">
        {!distance && <p className="text-sm font-semibold text-muted-foreground">{s.mainLabel}</p>}
        <TapeReadout
          value={s.main}
          valueTestId={distance ? 'length-main' : 'result-main'}
          secondary={distance ? formatLength(item.distanceM, other) : undefined}
          secondaryTestId={distance ? 'length-other' : undefined}
        />
      </div>
      {s.secondary.length > 0 && (
        <dl data-testid="result-secondary" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-[20px] bg-card p-4 text-card-foreground">
          {s.secondary.map((l) => (
            <div key={l.label} className="contents">
              <dt className="text-sm text-muted-foreground">{l.label}</dt>
              <dd className="text-right text-base font-semibold tabular-nums">{l.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.mode === 'room-plan' && <SavePdfButton item={item} unit={unit} />}
    </div>
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
    <Button variant="tonal" icon={FileText} loading={busy} onClick={() => void save()} className="self-start">
      Save PDF
    </Button>
  )
}
