import { formatAngle, formatArea, formatLength, formatLitres, formatVolume, type LengthUnit } from '../../lib/units'
import type { HistoryItem } from '../../state/history'
import { MODES } from '../catalog'

export interface ResultLine {
  label: string
  value: string
}

/** What to show for a saved measurement: one big value and a few short extras. */
export interface ResultSummary {
  modeName: string
  mainLabel: string
  main: string
  secondary: ResultLine[]
}

const NONE = Number.NaN
const len = (m: number | undefined, unit: LengthUnit) => formatLength(m ?? NONE, unit)

/** The headline value and extras of a measurement, in `unit`. Missing values show as '—'. */
export function resultSummary(item: HistoryItem, unit: LengthUnit): ResultSummary {
  const modeName = MODES.find((m) => m.id === item.mode)?.name ?? item.mode
  const seg = item.segmentsM ?? []
  const out = (mainLabel: string, main: string, secondary: ResultLine[] = []): ResultSummary => ({ modeName, mainLabel, main, secondary })

  switch (item.mode) {
    case 'path':
      return out('Total', len(item.distanceM, unit), [{ label: 'Parts', value: String(seg.length) }])
    case 'area':
      return out('Area', formatArea(item.areaM2 ?? NONE, unit), [{ label: 'Perimeter', value: len(item.perimeterM, unit) }])
    case 'angle':
      return out(
        'Angle',
        formatAngle(item.angleDeg ?? NONE),
        seg.slice(0, 2).map((m, i) => ({ label: `Side ${i + 1}`, value: len(m, unit) })),
      )
    case 'height':
      return out('Height', len(item.heightM, unit))
    case 'volume': {
      const m3 = item.volumeM3 ?? NONE
      const size = [item.lengthM, item.widthM, item.heightM].map((m) => len(m, unit)).join(' × ')
      // The other way round from the main value: litres under m³, m³ under litres.
      const other = unit === 'cm' && m3 < 1 ? { label: 'Cubic metres', value: `${m3.toFixed(3)} m³` } : { label: 'Litres', value: formatLitres(m3) }
      const base = item.areaM2 ?? (item.lengthM ?? NONE) * (item.widthM ?? NONE)
      return out('Volume', formatVolume(m3, unit), [{ label: 'Size', value: size }, other, { label: 'Base', value: formatArea(base, unit) }])
    }
    case 'room-plan': {
      const extra: ResultLine[] = [
        { label: 'Perimeter', value: len(item.perimeterM, unit) },
        { label: 'Walls', value: String(seg.length) },
      ]
      if (item.wallHeightM !== undefined) {
        extra.push({ label: 'Wall height', value: len(item.wallHeightM, unit) })
        extra.push({ label: 'Wall area', value: formatArea((item.perimeterM ?? NONE) * item.wallHeightM, unit) })
      }
      return out('Floor area', formatArea(item.areaM2 ?? NONE, unit), extra)
    }
    case 'photo': {
      const lines = item.photo?.lines ?? []
      return out(
        lines.length > 1 ? 'Line 1' : 'Length',
        len(lines[0]?.lengthM ?? item.distanceM, unit),
        lines.slice(1).map((l, i) => ({ label: `Line ${i + 2}`, value: len(l.lengthM, unit) })),
      )
    }
    default:
      return out('Length', len(item.distanceM, unit))
  }
}

/** Plain text to share, e.g. "Area 2.50 m² · Perimeter 6.40 m. Measured with Measure Sama". Never a link. */
export function shareText(item: HistoryItem, unit: LengthUnit): string {
  const s = resultSummary(item, unit)
  const parts = [{ label: s.mainLabel, value: s.main }, ...s.secondary].map((l) => `${l.label} ${l.value}`)
  return `${parts.join(' · ')}. Measured with Measure Sama`
}
