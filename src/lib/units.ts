import type { LengthUnit } from '../plugins/ar-measure/definitions'

export type { LengthUnit }

export const METRES_PER_INCH = 0.0254
const SQ_METRES_PER_SQ_FOOT = 0.09290304
const SQ_METRES_PER_SQ_INCH = 0.00064516

export const UNIT_LABEL: Record<LengthUnit, string> = {
  cm: 'Centimetres (cm)',
  in: 'Inches (in)',
}

const ok = (n: number) => typeof n === 'number' && Number.isFinite(n) && n >= 0

/** Metres → centimetres or inches. */
export function metresTo(m: number, unit: LengthUnit): number {
  return unit === 'cm' ? m * 100 : m / METRES_PER_INCH
}

/**
 * The one length format, shared with the native AR label (keep them in step):
 * - cm: under 1 m → "12.3 cm"; from 1 m → "1.23 m".
 * - in: total inches rounded to 0.1 first; under 12 → "7.9 in", else "4 ft 0.6 in".
 * Negative, NaN and infinite values show as "—".
 */
export function formatLength(m: number, unit: LengthUnit): string {
  if (!ok(m)) return '—'
  if (unit === 'cm') return m < 1 ? `${(m * 100).toFixed(1)} cm` : `${m.toFixed(2)} m`
  const total = Math.round(metresTo(m, 'in') * 10) / 10
  if (total < 12) return `${total.toFixed(1)} in`
  const feet = Math.floor(total / 12)
  const rest = total - feet * 12
  return `${feet} ft ${rest.toFixed(1)} in`
}

/** Areas for later modes: "850 cm²" / "2.50 m²", "96 sq in" / "26.91 sq ft". */
export function formatArea(m2: number, unit: LengthUnit): string {
  if (!ok(m2)) return '—'
  if (unit === 'cm') return m2 < 1 ? `${Math.round(m2 * 10_000)} cm²` : `${m2.toFixed(2)} m²`
  const sqFt = m2 / SQ_METRES_PER_SQ_FOOT
  return sqFt < 1 ? `${Math.round(m2 / SQ_METRES_PER_SQ_INCH)} sq in` : `${sqFt.toFixed(2)} sq ft`
}

/** Countries that measure in inches day to day (US, Liberia, Myanmar). */
const INCH_REGIONS = new Set(['US', 'LR', 'MM'])

/** Default unit for a locale such as "en-US": inches in the US, Liberia and Myanmar, else centimetres. */
export function defaultUnitForLocale(locale: string | undefined): LengthUnit {
  if (!locale) return 'cm'
  const parts = locale.replace(/_/g, '-').split('-')
  const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p))
  return region && INCH_REGIONS.has(region.toUpperCase()) ? 'in' : 'cm'
}

export function isLengthUnit(v: unknown): v is LengthUnit {
  return v === 'cm' || v === 'in'
}
