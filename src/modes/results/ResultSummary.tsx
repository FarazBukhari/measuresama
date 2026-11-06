import { Capacitor } from '@capacitor/core'
import { Ruler } from 'lucide-react'
import { MeasurementPhoto } from '../../components/MeasurementPhoto'
import { formatDateTime } from '../../lib/format'
import type { LengthUnit } from '../../lib/units'
import type { HistoryItem } from '../../state/history'
import { MODES } from '../catalog'
import { resultSummary } from './summary'

/** A history row's content: the photo (or the mode's icon), the main value big, then mode, date and note. */
export function ResultSummary({ item, unit }: { item: HistoryItem; unit: LengthUnit }) {
  const s = resultSummary(item, unit)
  const Icon = MODES.find((m) => m.id === item.mode)?.icon ?? Ruler
  const hasPhoto = !!item.screenshotUri && Capacitor.isNativePlatform()
  return (
    <>
      {hasPhoto ? (
        <MeasurementPhoto uri={item.screenshotUri} alt="" className="size-14 shrink-0 rounded-md" />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground" aria-hidden="true">
          <Icon className="size-6" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-mono text-lg font-bold tabular-nums">{s.main}</span>
        <span className="truncate text-sm text-muted-foreground">{[s.modeName, formatDateTime(item.createdAt), item.note].filter(Boolean).join(' · ')}</span>
      </span>
    </>
  )
}
