/**
 * On-screen ruler: turn what we know about the screen into "CSS pixels per millimetre".
 *
 * Browsers never expose a screen's real pixel density (CSS says 1in = 96px, which is only true
 * on a 96 dpi monitor), so the scale comes from one of these, best first:
 *  1. Android app: the display's own report (DisplayMetrics.xdpi/ydpi) via the ScreenMetrics plugin.
 *  2. iPhone / iPad: Apple's published specs, matched by screen size in points.
 *  3. The user's screen size (diagonal) from the phone's or monitor's spec sheet.
 *  4. A bank card held against the screen (ISO/IEC 7810 ID-1, the same size worldwide).
 * Until one of these is confirmed, the ruler shows a clearly-labelled estimate.
 *
 * Android's xdpi/ydpi are often wrong (rounded or made up by the manufacturer), so the app asks
 * everyone to check once with a bank card and keeps that result per screen (see screenKey).
 */

export const MM_PER_INCH = 25.4
/** xdpi and ydpi may differ by this much (fraction) before we warn. */
export const AXIS_MISMATCH_LIMIT = 0.03
/** A card check may differ from the phone's own report by this much (fraction) before we warn. */
export const CARD_MISMATCH_LIMIT = 0.05
/** ISO/IEC 7810 ID-1: bank cards, ID cards, driving licences. */
export const CARD_WIDTH_MM = 85.6
export const CARD_HEIGHT_MM = 53.98

export type CalibrationSource = 'android-display' | 'device-specs' | 'screen-size' | 'card' | 'estimate'

export interface Calibration {
  /** CSS pixels per millimetre — the one number the ruler needs. */
  pxPerMm: number
  source: CalibrationSource
  /** The user checked it (said the screen size is right, matched a card, or typed the size). */
  confirmed: boolean
  /** e.g. "iPhone 15" or "Google Pixel 7". */
  device?: string
  /** Physical resolution and density when the source knows them exactly. */
  resolution?: [number, number]
  ppi?: number
  /** Marketing diagonal from a spec sheet, in inches. */
  specDiagonalIn?: number
  /** Warnings about the detected values (shown to the user). */
  warnings?: string[]
}

/** screen.width / screen.height (CSS px) and devicePixelRatio. */
export interface ScreenInfo {
  cssWidth: number
  cssHeight: number
  dpr: number
}

export function readScreen(): ScreenInfo {
  const s = typeof window !== 'undefined' ? window.screen : undefined
  return {
    cssWidth: s?.width || window.innerWidth || 0,
    cssHeight: s?.height || window.innerHeight || 0,
    dpr: window.devicePixelRatio || 1,
  }
}

/** Identifies one screen setup (orientation-independent), so a desktop calibration isn't reused on another monitor. */
export function screenKey(s: ScreenInfo): string {
  const a = Math.round(Math.min(s.cssWidth, s.cssHeight))
  const b = Math.round(Math.max(s.cssWidth, s.cssHeight))
  return `${a}x${b}@${Math.round(s.dpr * 100) / 100}`
}

const valid = (n: number) => Number.isFinite(n) && n > 0

/** Scale from the screen's diagonal size (spec sheet). Pixels are square, so the CSS diagonal maps onto it. */
export function pxPerMmFromDiagonal(s: ScreenInfo, diagonalIn: number): number {
  if (!valid(diagonalIn) || !valid(s.cssWidth) || !valid(s.cssHeight)) return NaN
  return Math.hypot(s.cssWidth, s.cssHeight) / (diagonalIn * MM_PER_INCH)
}

/** The screen's diagonal in inches implied by a scale. */
export function diagonalInFromPxPerMm(s: ScreenInfo, pxPerMm: number): number {
  if (!valid(pxPerMm)) return NaN
  return Math.hypot(s.cssWidth, s.cssHeight) / pxPerMm / MM_PER_INCH
}

/** Scale from an on-screen card outline the user resized to match a real card. */
export function pxPerMmFromCard(cardWidthPx: number): number {
  return valid(cardWidthPx) ? cardWidthPx / CARD_WIDTH_MM : NaN
}

/** Physical pixels per inch implied by a CSS scale (assumes device px = CSS px × dpr). */
export function ppiFromPxPerMm(pxPerMm: number, dpr: number): number {
  return pxPerMm * MM_PER_INCH * dpr
}

/** Approximate physical resolution: CSS size × devicePixelRatio, in the screen's own orientation. */
export function approxResolution(s: ScreenInfo): [number, number] {
  return [Math.round(s.cssWidth * s.dpr), Math.round(s.cssHeight * s.dpr)]
}

/**
 * Best guess when nothing is known. Android lays out 1 CSS px ≈ 1/160 in (its "dp"), and most
 * phones land within ±15% of that; desktop browsers assume 96 px per inch.
 */
export function estimateCalibration(isTouchDevice: boolean): Calibration {
  const pxPerIn = isTouchDevice ? 160 : 96
  return { pxPerMm: pxPerIn / MM_PER_INCH, source: 'estimate', confirmed: false }
}

// ---------------------------------------------------------------- Android display report

/** What the app's ScreenMetrics plugin returns (Android DisplayMetrics + Display.Mode). */
export interface AndroidMetrics {
  widthPixels: number
  heightPixels: number
  xdpi: number
  ydpi: number
  density: number
  densityDpi: number
  manufacturer?: string
  model?: string
}

/** Android's generalized density buckets. A real panel almost never lands exactly on one. */
const DENSITY_BUCKETS = [120, 140, 160, 180, 200, 213, 220, 240, 260, 280, 300, 320, 340, 360, 400, 420, 440, 480, 560, 600, 640]

/**
 * Turn the display's own report into a calibration. `dpr` is the WebView's devicePixelRatio,
 * which maps CSS px to device px. Some manufacturers report a rounded "bucket" density instead
 * of the real one, so suspicious values carry warnings and need the user's confirmation.
 */
export function fromAndroidMetrics(m: AndroidMetrics, dpr: number): Calibration | null {
  if (!valid(m.xdpi) || !valid(m.ydpi) || !valid(m.widthPixels) || !valid(m.heightPixels)) return null
  const scale = valid(dpr) ? dpr : valid(m.density) ? m.density : 1
  const ppi = (m.xdpi + m.ydpi) / 2
  const warnings: string[] = []
  if (Math.abs(m.xdpi - m.ydpi) / ppi > AXIS_MISMATCH_LIMIT) {
    warnings.push(`The screen reports different densities across (${Math.round(m.xdpi)} ppi) and down (${Math.round(m.ydpi)} ppi), which usually means one of them is wrong.`)
  }
  const isBucket = (v: number) => DENSITY_BUCKETS.some((b) => Math.abs(v - b) < 0.01)
  if (isBucket(m.xdpi) && isBucket(m.ydpi) && Math.abs(m.xdpi - m.densityDpi) < 0.01) {
    warnings.push(`The reported density (${Math.round(ppi)} ppi) is a standard Android setting rather than a measured value, so it may be rounded.`)
  }
  const diagonal = Math.hypot(m.widthPixels / m.xdpi, m.heightPixels / m.ydpi)
  if (diagonal < 2.5 || diagonal > 20 || ppi < 72 || ppi > 1000) {
    warnings.push(`The reported values give an unlikely ${diagonal.toFixed(1)}-inch screen.`)
  }
  const device = [m.manufacturer, m.model].filter(Boolean).join(' ').trim()
  return {
    pxPerMm: ppi / scale / MM_PER_INCH,
    source: 'android-display',
    confirmed: false,
    device: device ? capitalize(device) : undefined,
    resolution: [Math.min(m.widthPixels, m.heightPixels), Math.max(m.widthPixels, m.heightPixels)],
    ppi,
    warnings: warnings.length ? warnings : undefined,
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ---------------------------------------------------------------- Apple devices

export interface AppleDisplay {
  /** Models sharing this exact panel. */
  name: string
  /** Screen size in points (CSS px), portrait. */
  points: [number, number]
  /** UIScreen scale = devicePixelRatio. */
  scale: number
  /** Physical panel pixels, portrait (differs from points × scale on Plus and mini models, which downsample). */
  pixels: [number, number]
  ppi: number
  /** Marketing diagonal, inches. */
  diagonal: number
  kind: 'iphone' | 'ipad'
}

/** Apple's published display specs. Display Zoom changes the point size, so zoomed phones fall back to a manual check. */
export const APPLE_DISPLAYS: AppleDisplay[] = [
  { name: 'iPhone SE (1st gen), 5s, 5c, 5 or iPod touch', points: [320, 568], scale: 2, pixels: [640, 1136], ppi: 326, diagonal: 4, kind: 'iphone' },
  { name: 'iPhone SE (2nd or 3rd gen), 8, 7, 6s or 6', points: [375, 667], scale: 2, pixels: [750, 1334], ppi: 326, diagonal: 4.7, kind: 'iphone' },
  { name: 'iPhone 8 Plus, 7 Plus, 6s Plus or 6 Plus', points: [414, 736], scale: 3, pixels: [1080, 1920], ppi: 401, diagonal: 5.5, kind: 'iphone' },
  { name: 'iPhone 11 Pro, XS or X', points: [375, 812], scale: 3, pixels: [1125, 2436], ppi: 458, diagonal: 5.8, kind: 'iphone' },
  { name: 'iPhone 13 mini or 12 mini', points: [375, 812], scale: 3, pixels: [1080, 2340], ppi: 476, diagonal: 5.4, kind: 'iphone' },
  { name: 'iPhone 11 or XR', points: [414, 896], scale: 2, pixels: [828, 1792], ppi: 326, diagonal: 6.1, kind: 'iphone' },
  { name: 'iPhone 11 Pro Max or XS Max', points: [414, 896], scale: 3, pixels: [1242, 2688], ppi: 458, diagonal: 6.5, kind: 'iphone' },
  { name: 'iPhone 16e, 14, 13, 13 Pro, 12 or 12 Pro', points: [390, 844], scale: 3, pixels: [1170, 2532], ppi: 460, diagonal: 6.1, kind: 'iphone' },
  { name: 'iPhone 14 Plus, 13 Pro Max or 12 Pro Max', points: [428, 926], scale: 3, pixels: [1284, 2778], ppi: 458, diagonal: 6.7, kind: 'iphone' },
  { name: 'iPhone 16, 15, 15 Pro or 14 Pro', points: [393, 852], scale: 3, pixels: [1179, 2556], ppi: 460, diagonal: 6.1, kind: 'iphone' },
  { name: 'iPhone 16 Plus, 15 Plus, 15 Pro Max or 14 Pro Max', points: [430, 932], scale: 3, pixels: [1290, 2796], ppi: 460, diagonal: 6.7, kind: 'iphone' },
  { name: 'iPhone 17, 17 Pro or 16 Pro', points: [402, 874], scale: 3, pixels: [1206, 2622], ppi: 460, diagonal: 6.3, kind: 'iphone' },
  { name: 'iPhone Air', points: [420, 912], scale: 3, pixels: [1260, 2736], ppi: 460, diagonal: 6.5, kind: 'iphone' },
  { name: 'iPhone 17 Pro Max or 16 Pro Max', points: [440, 956], scale: 3, pixels: [1320, 2868], ppi: 460, diagonal: 6.9, kind: 'iphone' },
  { name: 'iPad mini (2nd–5th gen)', points: [768, 1024], scale: 2, pixels: [1536, 2048], ppi: 326, diagonal: 7.9, kind: 'ipad' },
  { name: 'iPad 9.7-inch, iPad Air (1st or 2nd gen) or iPad Pro 9.7-inch', points: [768, 1024], scale: 2, pixels: [1536, 2048], ppi: 264, diagonal: 9.7, kind: 'ipad' },
  { name: 'iPad mini (6th gen or A17 Pro)', points: [744, 1133], scale: 2, pixels: [1488, 2266], ppi: 326, diagonal: 8.3, kind: 'ipad' },
  { name: 'iPad 10.2-inch (7th–9th gen)', points: [810, 1080], scale: 2, pixels: [1620, 2160], ppi: 264, diagonal: 10.2, kind: 'ipad' },
  { name: 'iPad Air (3rd gen) or iPad Pro 10.5-inch', points: [834, 1112], scale: 2, pixels: [1668, 2224], ppi: 264, diagonal: 10.5, kind: 'ipad' },
  { name: 'iPad (10th gen or A16) or iPad Air 11-inch (4th gen or later)', points: [820, 1180], scale: 2, pixels: [1640, 2360], ppi: 264, diagonal: 10.9, kind: 'ipad' },
  { name: 'iPad Pro 11-inch (1st–4th gen)', points: [834, 1194], scale: 2, pixels: [1668, 2388], ppi: 264, diagonal: 11, kind: 'ipad' },
  { name: 'iPad Pro 11-inch (M4 or later)', points: [834, 1210], scale: 2, pixels: [1668, 2420], ppi: 264, diagonal: 11, kind: 'ipad' },
  { name: 'iPad Pro 12.9-inch or iPad Air 13-inch', points: [1024, 1366], scale: 2, pixels: [2048, 2732], ppi: 264, diagonal: 12.9, kind: 'ipad' },
  { name: 'iPad Pro 13-inch (M4 or later)', points: [1032, 1376], scale: 2, pixels: [2064, 2752], ppi: 264, diagonal: 13, kind: 'ipad' },
]

/** Is this an iPhone, iPod or iPad (iPadOS reports itself as a Mac with a touch screen)? */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

/** Apple displays whose point size and scale match this screen (possibly several models). */
export function matchAppleDisplays(s: ScreenInfo): AppleDisplay[] {
  const a = Math.round(Math.min(s.cssWidth, s.cssHeight))
  const b = Math.round(Math.max(s.cssWidth, s.cssHeight))
  return APPLE_DISPLAYS.filter((d) => d.points[0] === a && d.points[1] === b && Math.abs(d.scale - s.dpr) < 0.01)
}

export function fromAppleDisplay(d: AppleDisplay): Calibration {
  // CSS px per inch = physical ppi × (points / physical pixels); handles downsampling Plus/mini panels.
  const pxPerIn = (d.ppi * d.points[0]) / d.pixels[0]
  return {
    pxPerMm: pxPerIn / MM_PER_INCH,
    source: 'device-specs',
    confirmed: false,
    device: d.name,
    resolution: d.pixels,
    ppi: d.ppi,
    specDiagonalIn: d.diagonal,
  }
}

// ---------------------------------------------------------------- Ruler drawing

export type UnitSystem = 'metric' | 'imperial'

export interface Tick {
  /** Distance from the ruler's zero, CSS px. */
  pos: number
  /** Relative tick length, 0–1. */
  size: number
  label?: string
}

/** Smallest gap between ticks that stays readable, in CSS px. */
const MIN_TICK_GAP = 2.5

/** Tick marks for a ruler `lengthPx` long. Fine ticks are dropped when they would blur together. */
export function rulerTicks(lengthPx: number, pxPerMm: number, system: UnitSystem): Tick[] {
  if (!valid(lengthPx) || !valid(pxPerMm)) return []
  const ticks: Tick[] = []
  if (system === 'metric') {
    const stepMm = pxPerMm >= MIN_TICK_GAP ? 1 : pxPerMm * 5 >= MIN_TICK_GAP ? 5 : 10
    const count = Math.floor(lengthPx / pxPerMm / stepMm + 1e-9)
    for (let i = 0; i <= count; i++) {
      const mm = i * stepMm
      const cm = mm % 10 === 0
      ticks.push({ pos: mm * pxPerMm, size: cm ? 1 : mm % 5 === 0 ? 0.65 : 0.4, label: cm ? String(mm / 10) : undefined })
    }
    return ticks
  }
  const pxPerIn = pxPerMm * MM_PER_INCH
  const divisions = [16, 8, 4, 2, 1].find((d) => pxPerIn / d >= MIN_TICK_GAP) ?? 1
  const count = Math.floor((lengthPx / pxPerIn) * divisions + 1e-9)
  for (let i = 0; i <= count; i++) {
    const sixteenths = (i * 16) / divisions
    const size = sixteenths % 16 === 0 ? 1 : sixteenths % 8 === 0 ? 0.75 : sixteenths % 4 === 0 ? 0.55 : sixteenths % 2 === 0 ? 0.4 : 0.28
    ticks.push({ pos: (i / divisions) * pxPerIn, size, label: sixteenths % 16 === 0 ? String(sixteenths / 16) : undefined })
  }
  return ticks
}

// ---------------------------------------------------------------- Formatting

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/** 2.0625 → "2 1/16″", rounded to the nearest 1/16 inch. */
export function formatInchFraction(inches: number): string {
  if (!Number.isFinite(inches)) return '—'
  const sign = inches < 0 ? '−' : ''
  const total = Math.round(Math.abs(inches) * 16)
  const whole = Math.floor(total / 16)
  const rest = total % 16
  if (!rest) return `${sign}${whole}″`
  const g = gcd(rest, 16)
  const frac = `${rest / g}/${16 / g}`
  return `${sign}${whole ? `${whole} ` : ''}${frac}″`
}

/** 7.5 → "7.5 mm", 53.2 → "5.32 cm", 1234 → "123.4 cm". */
export function formatMetric(mm: number): string {
  if (!Number.isFinite(mm)) return '—'
  if (Math.abs(mm) < 10) return `${mm.toFixed(1)} mm`
  return `${(mm / 10).toFixed(mm < 1000 ? 2 : 1)} cm`
}

export const SOURCE_LABEL: Record<CalibrationSource, string> = {
  'android-display': 'Your phone’s display report',
  'device-specs': 'Apple’s screen specs',
  'screen-size': 'The screen size you entered',
  card: 'Matched against a card',
  estimate: 'Estimate (not checked)',
}

/** Inches ↔ cm for the diagonal entry. */
export const inchesFrom = (value: number, unit: 'in' | 'cm') => (unit === 'cm' ? value / 2.54 : value)

// ---------------------------------------------------------------- Calibration rules

/** The user matched a real card on this screen: the most trusted scale. */
export function isCardChecked(c: Calibration | undefined): boolean {
  return !!c && c.source === 'card' && c.confirmed && valid(c.pxPerMm)
}

/** Anything the user hasn't confirmed is shown as an estimate. */
export function isEstimate(c: Calibration): boolean {
  return !c.confirmed
}

/**
 * How far (as a fraction) a card check is from what the phone or Apple's specs say, or null
 * when there's nothing real to compare with (a plain estimate is only a guess).
 */
export function cardDisagreement(cardPxPerMm: number, detected: Calibration): number | null {
  if (!valid(cardPxPerMm) || !valid(detected.pxPerMm)) return null
  if (detected.source !== 'android-display' && detected.source !== 'device-specs') return null
  return Math.abs(cardPxPerMm - detected.pxPerMm) / detected.pxPerMm
}

/** Warnings to show for the scale in use. `detected` is what the phone reported on its own. */
export function calibrationWarnings(current: Calibration, detected: Calibration): string[] {
  if (current.source === 'card') {
    const off = cardDisagreement(current.pxPerMm, detected)
    if (off !== null && off > CARD_MISMATCH_LIMIT) {
      return [
        `Your card check is ${Math.round(off * 100)}% off from the size your phone reports. Make sure the card lies flat and its corner sits exactly in the outline’s corner, then check again.`,
      ]
    }
    return []
  }
  return current.confirmed ? [] : (current.warnings ?? [])
}
