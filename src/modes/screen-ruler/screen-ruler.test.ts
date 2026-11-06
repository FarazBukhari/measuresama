import { describe, expect, it, vi } from 'vitest'
import {
  APPLE_DISPLAYS,
  CARD_HEIGHT_MM,
  calibrationWarnings,
  cardDisagreement,
  isCardChecked,
  isEstimate,
  type Calibration,
  approxResolution,
  CARD_WIDTH_MM,
  diagonalInFromPxPerMm,
  estimateCalibration,
  formatInchFraction,
  formatMetric,
  fromAndroidMetrics,
  fromAppleDisplay,
  inchesFrom,
  isAppleMobile,
  matchAppleDisplays,
  MM_PER_INCH,
  ppiFromPxPerMm,
  pxPerMmFromCard,
  pxPerMmFromDiagonal,
  rulerTicks,
  screenKey,
} from './screen-ruler'

const iphone15 = { cssWidth: 393, cssHeight: 852, dpr: 3 }

describe('scale from the screen size', () => {
  it('maps the CSS diagonal onto the spec-sheet diagonal', () => {
    // hypot(390, 844) = 929.76 CSS px over 6.1 in = 154.94 mm
    expect(pxPerMmFromDiagonal({ cssWidth: 390, cssHeight: 844, dpr: 3 }, 6.1)).toBeCloseTo(6.0008, 3)
  })
  it('round-trips with the diagonal', () => {
    const s = { cssWidth: 1280, cssHeight: 720, dpr: 1 }
    expect(diagonalInFromPxPerMm(s, pxPerMmFromDiagonal(s, 15.6))).toBeCloseTo(15.6, 10)
  })
  it('rejects nonsense', () => {
    expect(pxPerMmFromDiagonal(iphone15, 0)).toBeNaN()
    expect(pxPerMmFromDiagonal(iphone15, Number.NaN)).toBeNaN()
    expect(pxPerMmFromDiagonal({ cssWidth: 0, cssHeight: 0, dpr: 1 }, 6)).toBeNaN()
  })
})

describe('card and estimate', () => {
  it('uses the ISO ID-1 card width', () => {
    expect(pxPerMmFromCard(CARD_WIDTH_MM * 6)).toBeCloseTo(6, 12)
    expect(pxPerMmFromCard(0)).toBeNaN()
  })
  it('estimates 160 px/in on touch screens and 96 px/in on desktops', () => {
    expect(estimateCalibration(true).pxPerMm * MM_PER_INCH).toBeCloseTo(160)
    expect(estimateCalibration(false).pxPerMm * MM_PER_INCH).toBeCloseTo(96)
    expect(estimateCalibration(true).confirmed).toBe(false)
  })
  it('derives physical ppi and resolution', () => {
    expect(ppiFromPxPerMm(96 / 25.4, 2)).toBeCloseTo(192)
    expect(approxResolution({ cssWidth: 412, cssHeight: 915, dpr: 2.625 })).toEqual([1082, 2402])
  })
  it('converts cm to inches', () => {
    expect(inchesFrom(15.494, 'cm')).toBeCloseTo(6.1, 3)
    expect(inchesFrom(6.1, 'in')).toBe(6.1)
  })
})

describe('screen key', () => {
  it('is the same in portrait and landscape', () => {
    expect(screenKey({ cssWidth: 390, cssHeight: 844, dpr: 3 })).toBe('390x844@3')
    expect(screenKey({ cssWidth: 844, cssHeight: 390, dpr: 3 })).toBe('390x844@3')
  })
  it('changes with zoom / pixel ratio', () => {
    expect(screenKey({ cssWidth: 1536, cssHeight: 864, dpr: 1.25 })).not.toBe(screenKey({ cssWidth: 1536, cssHeight: 864, dpr: 1 }))
  })
})

describe('Android display report', () => {
  const pixel7 = { widthPixels: 1080, heightPixels: 2400, xdpi: 416, ydpi: 416, density: 2.625, densityDpi: 420, manufacturer: 'Google', model: 'Pixel 7' }

  it('turns xdpi into CSS px per mm using the WebView pixel ratio', () => {
    const c = fromAndroidMetrics(pixel7, 2.625)!
    expect(c.pxPerMm).toBeCloseTo(416 / 2.625 / 25.4, 6)
    expect(c.source).toBe('android-display')
    expect(c.device).toBe('Google Pixel 7')
    expect(c.resolution).toEqual([1080, 2400])
    expect(c.warnings).toBeUndefined()
    // 6.3-inch phone
    expect(diagonalInFromPxPerMm({ cssWidth: 1080 / 2.625, cssHeight: 2400 / 2.625, dpr: 2.625 }, c.pxPerMm)).toBeCloseTo(6.33, 2)
  })
  it('flags a rounded "bucket" density', () => {
    const c = fromAndroidMetrics({ ...pixel7, xdpi: 480, ydpi: 480, densityDpi: 480, density: 3 }, 3)!
    expect(c.warnings?.join(' ')).toMatch(/standard Android setting/)
  })
  it('flags mismatched axes and impossible sizes', () => {
    expect(fromAndroidMetrics({ ...pixel7, ydpi: 380 }, 2.625)!.warnings?.join(' ')).toMatch(/different densities/)
    expect(fromAndroidMetrics({ ...pixel7, xdpi: 40, ydpi: 40 }, 2.625)!.warnings?.join(' ')).toMatch(/unlikely/)
  })
  it('returns null without usable numbers', () => {
    expect(fromAndroidMetrics({ ...pixel7, xdpi: 0 }, 2.625)).toBeNull()
  })
})

describe('Apple displays', () => {
  it('every entry agrees with its own spec sheet', () => {
    for (const d of APPLE_DISPLAYS) {
      expect(Math.abs(Math.hypot(...d.pixels) / d.ppi - d.diagonal), d.name).toBeLessThan(0.15)
      expect(d.pixels[0], d.name).toBeLessThanOrEqual(d.points[0] * d.scale)
    }
  })
  it('matches an iPhone 15 in either orientation', () => {
    expect(matchAppleDisplays(iphone15).map((d) => d.name)).toEqual(['iPhone 16, 15, 15 Pro or 14 Pro'])
    expect(matchAppleDisplays({ cssWidth: 852, cssHeight: 393, dpr: 3 })).toHaveLength(1)
  })
  it('reports models that share a layout (mini vs X) so the user can pick', () => {
    expect(matchAppleDisplays({ cssWidth: 375, cssHeight: 812, dpr: 3 })).toHaveLength(2)
  })
  it('accounts for panels that downsample (Plus models)', () => {
    const plus = APPLE_DISPLAYS.find((d) => d.name.startsWith('iPhone 8 Plus'))!
    // 401 ppi × 414 pt / 1080 px = 153.7 CSS px per inch, not 401 / 3
    expect(fromAppleDisplay(plus).pxPerMm * MM_PER_INCH).toBeCloseTo(153.72, 1)
  })
  it('gives an iPhone 15 about 153 CSS px per inch', () => {
    const c = fromAppleDisplay(matchAppleDisplays(iphone15)[0])
    expect(c.pxPerMm * MM_PER_INCH).toBeCloseTo(153.33, 1)
    expect(c.specDiagonalIn).toBe(6.1)
  })
  it('detects iPhones and iPads (which pretend to be Macs)', () => {
    expect(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true)
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(isAppleMobile('Mozilla/5.0 (Linux; Android 14; K)', 5)).toBe(false)
  })
})

describe('ruler ticks', () => {
  it('draws millimetres with centimetre labels', () => {
    const ticks = rulerTicks(60.5, 6, 'metric')
    expect(ticks).toHaveLength(11)
    expect(ticks[10]).toEqual({ pos: 60, size: 1, label: '1' })
    expect(ticks[5].size).toBe(0.65)
    expect(ticks[1].label).toBeUndefined()
  })
  it('drops ticks that would blur together', () => {
    const ticks = rulerTicks(100, 1, 'metric')
    expect(ticks).toHaveLength(21) // every 5 mm
    expect(ticks[2]).toMatchObject({ pos: 10, label: '1' })
  })
  it('draws sixteenths of an inch', () => {
    const ticks = rulerTicks(152.4, 6, 'imperial')
    expect(ticks).toHaveLength(17)
    expect(ticks[16]).toMatchObject({ size: 1, label: '1' })
    expect(ticks[16].pos).toBeCloseTo(152.4)
    expect(ticks[8].size).toBe(0.75)
    expect(ticks[1].size).toBe(0.28)
  })
  it('handles empty input', () => {
    expect(rulerTicks(0, 6, 'metric')).toEqual([])
    expect(rulerTicks(100, Number.NaN, 'imperial')).toEqual([])
  })
})

describe('formatting', () => {
  it('formats inch fractions to the nearest 1/16', () => {
    expect(formatInchFraction(2.0625)).toBe('2 1/16″')
    expect(formatInchFraction(0.5)).toBe('1/2″')
    expect(formatInchFraction(3)).toBe('3″')
    expect(formatInchFraction(2.99)).toBe('3″')
    expect(formatInchFraction(-0.25)).toBe('−1/4″')
    expect(formatInchFraction(Number.NaN)).toBe('—')
  })
  it('formats metric lengths', () => {
    expect(formatMetric(7.5)).toBe('7.5 mm')
    expect(formatMetric(53.2)).toBe('5.32 cm')
    expect(formatMetric(1234)).toBe('123.4 cm')
  })
})

describe('bank-card calibration', () => {
  const android: Calibration = { pxPerMm: 6, source: 'android-display', confirmed: false }

  it('keeps the ISO/IEC 7810 ID-1 card size', () => {
    expect(CARD_WIDTH_MM).toBe(85.6)
    expect(CARD_HEIGHT_MM).toBe(53.98)
  })

  it('only counts a confirmed card match as card-checked', () => {
    expect(isCardChecked(undefined)).toBe(false)
    expect(isCardChecked({ pxPerMm: 6, source: 'card', confirmed: true })).toBe(true)
    expect(isCardChecked({ pxPerMm: 6, source: 'card', confirmed: false })).toBe(false)
    expect(isCardChecked({ pxPerMm: 6, source: 'screen-size', confirmed: true })).toBe(false)
    expect(isCardChecked({ pxPerMm: 6, source: 'android-display', confirmed: true })).toBe(false)
    expect(isCardChecked({ pxPerMm: Number.NaN, source: 'card', confirmed: true })).toBe(false)
  })

  it('labels every unconfirmed scale as an estimate, including the display report', () => {
    expect(isEstimate(android)).toBe(true)
    expect(isEstimate(estimateCalibration(true))).toBe(true)
    expect(isEstimate({ pxPerMm: 6, source: 'card', confirmed: true })).toBe(false)
  })

  it('measures how far a card check is from the phone report', () => {
    expect(cardDisagreement(6.3, android)).toBeCloseTo(0.05, 10)
    expect(cardDisagreement(5.7, android)).toBeCloseTo(0.05, 10)
    // A plain estimate is only a guess, so there is nothing to compare with.
    expect(cardDisagreement(6.3, estimateCalibration(true))).toBeNull()
    expect(cardDisagreement(0, android)).toBeNull()
  })

  it('warns when the card and the phone disagree by more than 5%', () => {
    const card = (pxPerMm: number): Calibration => ({ pxPerMm, source: 'card', confirmed: true })
    expect(calibrationWarnings(card(6.29), android)).toEqual([])
    expect(calibrationWarnings(card(6.4), android).join(' ')).toMatch(/7% off/)
    expect(calibrationWarnings(card(5.6), { ...android, source: 'device-specs' }).join(' ')).toMatch(/7% off/)
    expect(calibrationWarnings(card(9), estimateCalibration(true))).toEqual([])
  })

  it('warns when xdpi and ydpi differ by more than 3%, until the user has checked', () => {
    const base = { widthPixels: 1080, heightPixels: 2400, xdpi: 400, ydpi: 400, density: 2.625, densityDpi: 420 }
    expect(fromAndroidMetrics({ ...base, ydpi: 411 }, 2.625)!.warnings).toBeUndefined() // 2.7%
    const off = fromAndroidMetrics({ ...base, ydpi: 414 }, 2.625)! // 3.4%
    expect(calibrationWarnings(off, off).join(' ')).toMatch(/different densities/)
    expect(calibrationWarnings({ ...off, confirmed: true }, off)).toEqual([])
    // A card check replaces the axis warning with the card comparison.
    expect(calibrationWarnings({ pxPerMm: off.pxPerMm, source: 'card', confirmed: true }, off)).toEqual([])
  })
})

describe('saved calibrations', () => {
  async function fresh() {
    vi.resetModules()
    return import('./calibration')
  }

  it('are kept per screen and survive a reload', async () => {
    const c = await fresh()
    c.saveCalibration('390x844@3', { pxPerMm: 6.1, source: 'card', confirmed: true })
    c.saveCalibration('1920x1080@1', { pxPerMm: 3.8, source: 'screen-size', confirmed: true, specDiagonalIn: 24 })
    const reloaded = await fresh()
    expect(reloaded.calibrationsStore.get()['390x844@3']).toEqual({ pxPerMm: 6.1, source: 'card', confirmed: true })
    reloaded.forgetCalibration('390x844@3')
    expect(Object.keys(reloaded.calibrationsStore.get())).toEqual(['1920x1080@1'])
  })

  it('"Recalibrate" forgets only this screen', async () => {
    const c = await fresh()
    const here = screenKey({ cssWidth: window.screen.width || window.innerWidth, cssHeight: window.screen.height || window.innerHeight, dpr: window.devicePixelRatio || 1 })
    c.saveCalibration(here, { pxPerMm: 6, source: 'card', confirmed: true })
    c.saveCalibration('other', { pxPerMm: 5, source: 'card', confirmed: true })
    c.forgetThisScreen()
    expect(Object.keys(c.calibrationsStore.get())).toEqual(['other'])
  })

  it('drops broken entries', async () => {
    localStorage.setItem(
      'measuresama:screen-ruler:calibrations',
      JSON.stringify({ a: { pxPerMm: -1, source: 'card', confirmed: true }, b: { pxPerMm: 6, source: 'magic' }, c: { pxPerMm: 6, source: 'card', confirmed: 'yes' } }),
    )
    expect((await fresh()).calibrationsStore.get()).toEqual({ c: { pxPerMm: 6, source: 'card', confirmed: false } })
    localStorage.setItem('measuresama:screen-ruler:calibrations', '[1,2]')
    expect((await fresh()).calibrationsStore.get()).toEqual({})
  })
})
