import { describe, expect, it } from 'vitest'
import { defaultUnitForLocale, formatAngle, formatArea, formatLength, formatLitres, formatVolume, metresTo } from './units'

describe('formatLength (shared contract vectors)', () => {
  it.each([
    [0.1234, 'cm', '12.3 cm'],
    [1.2345, 'cm', '1.23 m'],
    [0.2, 'in', '7.9 in'],
    [0.3045, 'in', '1 ft 0.0 in'],
    [1.2345, 'in', '4 ft 0.6 in'],
  ] as const)('%s m in %s → %s', (m, unit, expected) => {
    expect(formatLength(m, unit)).toBe(expected)
  })
})

describe('formatLength edge cases', () => {
  it('shows zero as a length', () => {
    expect(formatLength(0, 'cm')).toBe('0.0 cm')
    expect(formatLength(0, 'in')).toBe('0.0 in')
  })
  it('shows a dash for negative, NaN and infinite values', () => {
    for (const unit of ['cm', 'in'] as const) {
      expect(formatLength(-0.5, unit)).toBe('—')
      expect(formatLength(Number.NaN, unit)).toBe('—')
      expect(formatLength(Number.POSITIVE_INFINITY, unit)).toBe('—')
      expect(formatLength(undefined, unit)).toBe('—')
    }
  })
  it('switches to metres at exactly 1 m', () => {
    expect(formatLength(0.999, 'cm')).toBe('99.9 cm')
    expect(formatLength(1, 'cm')).toBe('1.00 m')
    expect(formatLength(12.5, 'cm')).toBe('12.50 m')
  })
  it('rounds inches before splitting into feet', () => {
    // 11.96 in rounds to 12.0 → a whole foot, never "11 ft 12.0 in" style output
    expect(formatLength(11.96 * 0.0254, 'in')).toBe('1 ft 0.0 in')
    expect(formatLength(11.94 * 0.0254, 'in')).toBe('11.9 in')
    expect(formatLength(3.048, 'in')).toBe('10 ft 0.0 in')
  })
})

describe('metresTo', () => {
  it('converts', () => {
    expect(metresTo(1, 'cm')).toBe(100)
    expect(metresTo(0.0254, 'in')).toBeCloseTo(1, 12)
  })
})

describe('formatArea', () => {
  it('formats small and large areas', () => {
    expect(formatArea(0.085, 'cm')).toBe('850 cm²')
    expect(formatArea(2.5, 'cm')).toBe('2.50 m²')
    expect(formatArea(0.06, 'in')).toBe('93 sq in')
    expect(formatArea(2.5, 'in')).toBe('26.91 sq ft')
    expect(formatArea(Number.NaN, 'in')).toBe('—')
  })
})

describe('shared contract vectors: area, volume, angle', () => {
  it.each([
    [0.085, 'cm', '850 cm²'],
    [2.5, 'cm', '2.50 m²'],
    [2.5, 'in', '26.91 sq ft'],
  ] as const)('area %s m² in %s → %s', (m2, unit, expected) => {
    expect(formatArea(m2, unit)).toBe(expected)
  })
  it.each([
    [0.25, 'cm', '250 L'],
    [1.5, 'cm', '1.50 m³'],
    [0.25, 'in', '8.83 ft³'],
  ] as const)('volume %s m³ in %s → %s', (m3, unit, expected) => {
    expect(formatVolume(m3, unit)).toBe(expected)
  })
  it.each([
    [90, '90.0°'],
    [45.04, '45.0°'],
  ] as const)('angle %s → %s', (deg, expected) => {
    expect(formatAngle(deg)).toBe(expected)
  })
})

describe('formatVolume, formatLitres and formatAngle edge cases', () => {
  it('switches to m³ at exactly 1 m³', () => {
    expect(formatVolume(0.9994, 'cm')).toBe('999 L')
    expect(formatVolume(1, 'cm')).toBe('1.00 m³')
    expect(formatVolume(0, 'cm')).toBe('0 L')
    expect(formatVolume(0, 'in')).toBe('0.00 ft³')
  })
  it('shows litres', () => {
    expect(formatLitres(0.25)).toBe('250 L')
    expect(formatLitres(1.5)).toBe('1500 L')
    expect(formatLitres(0.0004)).toBe('0 L')
  })
  it('shows angles', () => {
    expect(formatAngle(0)).toBe('0.0°')
    expect(formatAngle(180)).toBe('180.0°')
    expect(formatAngle(89.96)).toBe('90.0°')
  })
  it('shows a dash for negative, NaN and infinite values', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatVolume(bad, 'cm')).toBe('—')
      expect(formatVolume(bad, 'in')).toBe('—')
      expect(formatLitres(bad)).toBe('—')
      expect(formatAngle(bad)).toBe('—')
      expect(formatArea(bad, 'cm')).toBe('—')
    }
  })
})

describe('defaultUnitForLocale', () => {
  it('uses inches in the US, Liberia and Myanmar', () => {
    expect(defaultUnitForLocale('en-US')).toBe('in')
    expect(defaultUnitForLocale('en-LR')).toBe('in')
    expect(defaultUnitForLocale('my-MM')).toBe('in')
    expect(defaultUnitForLocale('es_US')).toBe('in')
  })
  it('uses centimetres everywhere else', () => {
    expect(defaultUnitForLocale('en-GB')).toBe('cm')
    expect(defaultUnitForLocale('de-DE')).toBe('cm')
    expect(defaultUnitForLocale('zh-Hant-TW')).toBe('cm')
    expect(defaultUnitForLocale('en')).toBe('cm')
    expect(defaultUnitForLocale(undefined)).toBe('cm')
  })
})
