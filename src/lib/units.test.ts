import { describe, expect, it } from 'vitest'
import { defaultUnitForLocale, formatArea, formatLength, metresTo } from './units'

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
