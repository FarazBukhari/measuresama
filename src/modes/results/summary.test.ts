import { describe, expect, it } from 'vitest'
import type { HistoryItem } from '../../state/history'
import { resultSummary, shareText } from './summary'

const base = { id: 'x', unit: 'cm' as const, createdAt: '2026-11-01T10:00:00.000Z', points: [] }
const item = (over: Partial<HistoryItem> & Pick<HistoryItem, 'mode'>): HistoryItem => ({ ...base, ...over })

describe('resultSummary', () => {
  it('distance', () => {
    const i = item({ mode: 'distance', distanceM: 1.2345 })
    expect(resultSummary(i, 'cm')).toEqual({ modeName: 'Distance', mainLabel: 'Length', main: '1.23 m', secondary: [] })
    expect(resultSummary(i, 'in').main).toBe('4 ft 0.6 in')
  })

  it('path', () => {
    const i = item({ mode: 'path', distanceM: 2.5, segmentsM: [1, 1, 0.5] })
    expect(resultSummary(i, 'cm')).toEqual({ modeName: 'Path', mainLabel: 'Total', main: '2.50 m', secondary: [{ label: 'Parts', value: '3' }] })
    expect(resultSummary(i, 'in').main).toBe('8 ft 2.4 in')
  })

  it('area', () => {
    const i = item({ mode: 'area', areaM2: 2.5, perimeterM: 6.4, segmentsM: [2, 1.2, 2, 1.2] })
    expect(resultSummary(i, 'cm')).toEqual({
      modeName: 'Area & perimeter',
      mainLabel: 'Area',
      main: '2.50 m²',
      secondary: [{ label: 'Perimeter', value: '6.40 m' }],
    })
    expect(resultSummary(i, 'in')).toMatchObject({ main: '26.91 sq ft', secondary: [{ label: 'Perimeter', value: '21 ft 0.0 in' }] })
  })

  it('angle', () => {
    const i = item({ mode: 'angle', angleDeg: 90, segmentsM: [0.5, 0.3048] })
    expect(resultSummary(i, 'cm')).toEqual({
      modeName: 'Angle',
      mainLabel: 'Angle',
      main: '90.0°',
      secondary: [
        { label: 'Side 1', value: '50.0 cm' },
        { label: 'Side 2', value: '30.5 cm' },
      ],
    })
    expect(resultSummary(i, 'in').secondary).toEqual([
      { label: 'Side 1', value: '1 ft 7.7 in' },
      { label: 'Side 2', value: '1 ft 0.0 in' },
    ])
    expect(resultSummary(item({ mode: 'angle', angleDeg: 45.04 }), 'cm')).toMatchObject({ main: '45.0°', secondary: [] })
  })

  it('height', () => {
    const i = item({ mode: 'height', heightM: 1.8, distanceM: 1.8 })
    expect(resultSummary(i, 'cm')).toEqual({ modeName: 'Height', mainLabel: 'Height', main: '1.80 m', secondary: [] })
    expect(resultSummary(i, 'in').main).toBe('5 ft 10.9 in')
  })

  it('volume', () => {
    const small = item({ mode: 'volume', lengthM: 1, widthM: 0.5, heightM: 0.5, areaM2: 0.5, volumeM3: 0.25 })
    expect(resultSummary(small, 'cm')).toEqual({
      modeName: 'Volume',
      mainLabel: 'Volume',
      main: '250 L',
      secondary: [
        { label: 'Size', value: '1.00 m × 50.0 cm × 50.0 cm' },
        { label: 'Cubic metres', value: '0.250 m³' },
        { label: 'Base', value: '5000 cm²' },
      ],
    })
    expect(resultSummary(small, 'in')).toEqual({
      modeName: 'Volume',
      mainLabel: 'Volume',
      main: '8.83 ft³',
      secondary: [
        { label: 'Size', value: '3 ft 3.4 in × 1 ft 7.7 in × 1 ft 7.7 in' },
        { label: 'Litres', value: '250 L' },
        { label: 'Base', value: '5.38 sq ft' },
      ],
    })
    const big = item({ mode: 'volume', lengthM: 2, widthM: 1.5, heightM: 0.5, volumeM3: 1.5 })
    expect(resultSummary(big, 'cm')).toMatchObject({ main: '1.50 m³', secondary: [{ label: 'Size' }, { label: 'Litres', value: '1500 L' }, { label: 'Base', value: '3.00 m²' }] })
  })

  it('room plan, with and without wall height', () => {
    const room = item({ mode: 'room-plan', areaM2: 12, perimeterM: 14, segmentsM: [4, 3, 4, 3] })
    expect(resultSummary(room, 'cm')).toEqual({
      modeName: 'Room plan + PDF',
      mainLabel: 'Floor area',
      main: '12.00 m²',
      secondary: [
        { label: 'Perimeter', value: '14.00 m' },
        { label: 'Walls', value: '4' },
      ],
    })
    expect(resultSummary({ ...room, wallHeightM: 2.5 }, 'cm').secondary).toEqual([
      { label: 'Perimeter', value: '14.00 m' },
      { label: 'Walls', value: '4' },
      { label: 'Wall height', value: '2.50 m' },
      { label: 'Wall area', value: '35.00 m²' },
    ])
    expect(resultSummary({ ...room, wallHeightM: 2.5 }, 'in').secondary).toEqual([
      { label: 'Perimeter', value: '45 ft 11.2 in' },
      { label: 'Walls', value: '4' },
      { label: 'Wall height', value: '8 ft 2.4 in' },
      { label: 'Wall area', value: '376.74 sq ft' },
    ])
  })

  it('photo', () => {
    const photo = {
      imageWidth: 400,
      imageHeight: 300,
      card: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 6 },
        { x: 0, y: 6 },
      ],
      lines: [
        { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, lengthM: 0.123 },
        { a: { x: 0, y: 0 }, b: { x: 0, y: 50 }, lengthM: 0.0615 },
      ],
    }
    const two = item({ mode: 'photo', distanceM: 0.123, photo })
    expect(resultSummary(two, 'cm')).toEqual({ modeName: 'Photo measure', mainLabel: 'Line 1', main: '12.3 cm', secondary: [{ label: 'Line 2', value: '6.2 cm' }] })
    expect(resultSummary(two, 'in')).toMatchObject({ main: '4.8 in', secondary: [{ value: '2.4 in' }] })
    const one = item({ mode: 'photo', distanceM: 0.123, photo: { ...photo, lines: photo.lines.slice(0, 1) } })
    expect(resultSummary(one, 'cm')).toMatchObject({ mainLabel: 'Length', main: '12.3 cm', secondary: [] })
  })

  it('shows a dash for missing values instead of crashing', () => {
    expect(resultSummary(item({ mode: 'area' }), 'cm')).toMatchObject({ main: '—', secondary: [{ value: '—' }] })
    expect(resultSummary(item({ mode: 'volume' }), 'cm').main).toBe('—')
    expect(resultSummary(item({ mode: 'photo' }), 'cm').main).toBe('—')
  })
})

describe('shareText', () => {
  it('joins the values in plain text, without links', () => {
    expect(shareText(item({ mode: 'area', areaM2: 2.5, perimeterM: 6.4 }), 'cm')).toBe('Area 2.50 m² · Perimeter 6.40 m. Measured with Measure Sama')
    expect(shareText(item({ mode: 'distance', distanceM: 1.2345 }), 'in')).toBe('Length 4 ft 0.6 in. Measured with Measure Sama')
    expect(shareText(item({ mode: 'path', distanceM: 2.5, segmentsM: [1, 1.5] }), 'cm')).toBe('Total 2.50 m · Parts 2. Measured with Measure Sama')
  })
})
