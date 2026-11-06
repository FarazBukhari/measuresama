/** Format a number with locale grouping and a max number of fraction digits. */
export function formatNumber(value: number, maximumFractionDigits = 2, minimumFractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits, minimumFractionDigits }).format(value)
}

/** Format a number as currency, e.g. formatCurrency(12.5, 'USD') → $12.50 */
export function formatCurrency(value: number, currency = 'USD', maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits,
      minimumFractionDigits: Math.min(2, maximumFractionDigits),
    }).format(value)
  } catch {
    return `${formatNumber(value, maximumFractionDigits)} ${currency}`
  }
}

/** Format a percentage value already expressed in percent units (12.3 → "12.3%"). */
export function formatPercent(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return `${formatNumber(value, maximumFractionDigits)}%`
}

/** Parse a user-entered number; returns NaN for empty/invalid input. Accepts "1,234.5". */
export function parseNumber(input: string | number): number {
  if (typeof input === 'number') return input
  const cleaned = input.replace(/[\s,_]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return Number.NaN
  return Number(cleaned)
}

/** Pad a number with leading zeros. */
export function pad(value: number, length = 2): string {
  return String(Math.trunc(value)).padStart(length, '0')
}

/** Format milliseconds as HH:MM:SS(.mmm) */
export function formatDuration(ms: number, withMillis = false): string {
  const sign = ms < 0 ? '-' : ''
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const s = Math.floor((abs % 60_000) / 1000)
  const msPart = Math.floor(abs % 1000)
  const base = `${sign}${pad(h)}:${pad(m)}:${pad(s)}`
  return withMillis ? `${base}.${pad(msPart, 3)}` : base
}

/** "6 Nov 2026, 14:05" in the user's locale; empty for an invalid date. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
