import { MeasurementPhoto } from '../../components/MeasurementPhoto'
import { ModeArt } from '../../components/ModeArt'
import type { LengthUnit } from '../../lib/units'
import type { HistoryItem } from '../../state/history'
import { resultSummary } from './summary'

/** "6 Nov" this year, "6 Nov 2025" before. Empty for a bad date. */
function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

/** A history row's content: the photo (or the mode's picture), the main value big, then the note or mode, and the date. */
export function ResultSummary({ item, unit }: { item: HistoryItem; unit: LengthUnit }) {
  const s = resultSummary(item, unit)
  return (
    <>
      <MeasurementPhoto
        uri={item.screenshotUri}
        alt=""
        className="size-12 shrink-0 overflow-hidden rounded-xl"
        placeholder={<ModeArt id={item.mode} className="size-8" />}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xl font-bold tabular-nums">{s.main}</span>
        <span className="truncate text-sm text-muted-foreground">{[item.note || s.modeName, shortDate(item.createdAt)].filter(Boolean).join(' · ')}</span>
      </span>
    </>
  )
}
