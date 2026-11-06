import { Capacitor } from '@capacitor/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArDistanceMeasurement, ArMeasurement } from '../plugins/ar-measure/definitions'
import { storage } from '../lib/storage'

const deleteFile = vi.fn(async (_opts: { path: string }) => undefined)
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { deleteFile } }))
const downloadText = vi.fn(async (_text: string, _name: string, _mime?: string) => ({ method: 'download' as const }))
vi.mock('../lib/download', () => ({ downloadText }))

async function fresh() {
  vi.resetModules()
  return import('./history')
}

function measurement(over: Partial<ArDistanceMeasurement> = {}): ArDistanceMeasurement {
  return {
    cancelled: false,
    mode: 'distance',
    unit: 'cm',
    points: [
      { x: 0, y: 0, z: 0 },
      { x: 1.2345, y: 0, z: 0 },
    ],
    distanceM: 1.2345,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...over,
  }
}

const CSV_HEADER = 'Date,Mode,Length (m),Result,Unit,Area (m²),Perimeter (m),Angle (°),Height (m),Width (m),Volume (m³),Wall height (m),Segments (m),Note,Photo'

afterEach(() => {
  vi.restoreAllMocks()
  deleteFile.mockClear()
  downloadText.mockClear()
})

describe('history', () => {
  it('adds a measurement in metres and lists newest first', async () => {
    const h = await fresh()
    const a = h.addFromArResult(measurement({ createdAt: '2026-11-01T10:00:00Z' }))
    const b = h.addFromArResult(measurement({ distanceM: 0.5, createdAt: '2026-11-02T10:00:00Z' }))
    h.addFromArResult(measurement({ distanceM: 0.1, createdAt: '2026-10-30T10:00:00Z' }))
    expect(h.listHistory().map((i) => i.distanceM)).toEqual([0.5, 1.2345, 0.1])
    expect(a.id).not.toBe(b.id)
    expect(a).toMatchObject({ mode: 'distance', unit: 'cm', distanceM: 1.2345, points: [{ x: 0 }, { x: 1.2345 }] })
  })

  it('stores the photo URI, never image data', async () => {
    const h = await fresh()
    h.addFromArResult(measurement({ screenshot: { uri: 'file:///data/user/0/x/files/measurements/a.jpg', width: 10, height: 10, mimeType: 'image/jpeg' } }))
    const raw = localStorage.getItem(h.HISTORY_KEY)!
    expect(JSON.parse(raw)).toMatchObject({ version: 2, items: [{ screenshotUri: 'file:///data/user/0/x/files/measurements/a.jpg' }] })
    expect(raw).not.toContain('base64')
  })

  it('persists across a reload', async () => {
    const h = await fresh()
    const item = h.addFromArResult(measurement())
    h.setHistoryNote(item.id, 'Sofa, back wall')
    const reloaded = await fresh()
    expect(reloaded.listHistory()).toEqual([{ ...item, note: 'Sofa, back wall' }])
    reloaded.setHistoryNote(item.id, '   ')
    expect(reloaded.getHistoryItem(item.id)?.note).toBeUndefined()
  })

  it('removes one item and clears all', async () => {
    const h = await fresh()
    const a = h.addFromArResult(measurement())
    h.addFromArResult(measurement())
    await h.removeHistoryItem(a.id)
    expect(h.listHistory()).toHaveLength(1)
    expect(h.getHistoryItem(a.id)).toBeUndefined()
    await h.clearHistory()
    expect(h.listHistory()).toEqual([])
    expect((await fresh()).listHistory()).toEqual([])
    // Browser: there are no photo files to delete.
    expect(deleteFile).not.toHaveBeenCalled()
  })

  it('deletes the photo file in the app, and only when there is one', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    const h = await fresh()
    const uri = 'file:///data/user/0/x/files/measurements/b.jpg'
    const withPhoto = h.addFromArResult(measurement({ screenshot: { uri, width: 1, height: 1, mimeType: 'image/jpeg' } }))
    const withoutPhoto = h.addFromArResult(measurement())
    await h.removeHistoryItem(withoutPhoto.id)
    expect(deleteFile).not.toHaveBeenCalled()
    deleteFile.mockRejectedValueOnce(new Error('File does not exist'))
    await expect(h.removeHistoryItem(withPhoto.id)).resolves.toBeUndefined()
    expect(deleteFile).toHaveBeenCalledWith({ path: uri })
    expect(h.listHistory()).toEqual([])
  })

  it('ignores corrupt data and unknown versions', async () => {
    localStorage.setItem('measuresama:history', '{not json')
    expect((await fresh()).listHistory()).toEqual([])
    localStorage.setItem('measuresama:history', JSON.stringify({ version: 3, items: [{ id: 'x', mode: 'distance', distanceM: 1, createdAt: '2026-01-01T00:00:00Z' }] }))
    expect((await fresh()).listHistory()).toEqual([])
    localStorage.setItem('measuresama:history', JSON.stringify([1, 2, 3]))
    expect((await fresh()).listHistory()).toEqual([])
    localStorage.setItem(
      'measuresama:history',
      JSON.stringify({
        version: 1,
        items: [
          null,
          { id: 'bad-length', mode: 'distance', distanceM: 'long', createdAt: '2026-01-01T00:00:00Z' },
          { id: 'bad-date', mode: 'distance', distanceM: 1, createdAt: 'yesterday' },
          { id: 'bad-mode', mode: 'teleport', distanceM: 1, createdAt: '2026-01-01T00:00:00Z' },
          { id: 'ok', mode: 'distance', distanceM: 2, createdAt: '2026-01-01T00:00:00Z', unit: 'yards', points: [{ x: 1 }], screenshotUri: 'javascript:alert(1)' },
        ],
      }),
    )
    const h = await fresh()
    expect(h.listHistory()).toEqual([{ id: 'ok', mode: 'distance', distanceM: 2, createdAt: '2026-01-01T00:00:00Z', unit: 'cm', points: [] }])
    // A broken file is replaced, not appended to, on the next save.
    h.addFromArResult(measurement())
    expect(JSON.parse(localStorage.getItem('measuresama:history')!).items).toHaveLength(2)
  })
})

describe('export', () => {
  it('escapes CSV cells', async () => {
    const { csvCell } = await fresh()
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('-5')).toBe("'-5")
    expect(csvCell(1.5)).toBe('1.5')
    expect(csvCell(undefined)).toBe('')
  })

  it('writes one row per measurement with metres and the shown length', async () => {
    const h = await fresh()
    const item = h.addFromArResult(measurement({ unit: 'in' }))
    h.setHistoryNote(item.id, 'Desk, "big" one')
    const csv = h.historyToCsv(h.listHistory())
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe(CSV_HEADER)
    expect(lines[1]).toBe('2026-11-01T10:00:00.000Z,distance,1.2345,4 ft 0.6 in,in,,,,,,,,,"Desk, ""big"" one",no')
  })

  it('exports through the shared download helper', async () => {
    const h = await fresh()
    h.addFromArResult(measurement())
    await h.exportCsv()
    await h.exportJson()
    expect(downloadText).toHaveBeenCalledTimes(2)
    const [csv, csvName, csvMime] = downloadText.mock.calls[0]
    expect(csv).toContain('1.23 m')
    expect(csvName).toMatch(/^measure-sama-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(csvMime).toBe('text/csv')
    const json = JSON.parse(downloadText.mock.calls[1][0])
    expect(json).toMatchObject({ app: 'Measure Sama', version: 2, items: [{ distanceM: 1.2345 }] })
  })
})

// ---------------------------------------------------------------- v2: every mode

const P = (x: number, y: number, z: number) => ({ x, y, z })
const shot = { uri: 'file:///data/user/0/x/files/measurements/m.jpg', width: 4, height: 3, mimeType: 'image/jpeg' as const }
const common = { cancelled: false as const, unit: 'cm' as const, createdAt: '2026-11-03T10:00:00.000Z' }

const AR_RESULTS: Record<ArMeasurement['mode'], ArMeasurement> = {
  distance: { ...common, mode: 'distance', points: [P(0, 0, 0), P(1.2345, 0, 0)], distanceM: 1.2345 },
  path: { ...common, mode: 'path', points: [P(0, 0, 0), P(1, 0, 0), P(1, 0, 1.5)], segmentsM: [1, 1.5], distanceM: 2.5 },
  area: {
    ...common,
    mode: 'area',
    points: [P(0, 0, 0), P(2, 0, 0), P(2, 0, 1.25), P(0, 0, 1.25)],
    segmentsM: [2, 1.25, 2, 1.25],
    perimeterM: 6.5,
    areaM2: 2.5,
    distanceM: 6.5,
    screenshot: shot,
  },
  angle: { ...common, mode: 'angle', points: [P(1, 0, 0), P(0, 0, 0), P(0, 0, 0.5)], angleDeg: 90, segmentsM: [1, 0.5] },
  height: { ...common, mode: 'height', points: [P(0, 0, 0), P(0, 1.8, 0)], heightM: 1.8, distanceM: 1.8 },
  volume: {
    ...common,
    mode: 'volume',
    points: [P(0, 0, 0), P(1, 0, 0), P(1, 0, 0.5), P(1, 0.5, 0.5)],
    lengthM: 1,
    widthM: 0.5,
    heightM: 0.5,
    areaM2: 0.5,
    volumeM3: 0.25,
  },
  'room-plan': {
    ...common,
    mode: 'room-plan',
    points: [P(0, 0, 0), P(4, 0, 0), P(4, 0, 3), P(0, 0, 3)],
    segmentsM: [4, 3, 4, 3],
    perimeterM: 14,
    areaM2: 12,
    wallHeightM: 2.5,
    distanceM: 14,
  },
}

const PHOTO = {
  imageWidth: 4000,
  imageHeight: 3000,
  card: [P(10, 10, 0), P(110, 10, 0), P(110, 73, 0), P(10, 73, 0)].map(({ x, y }) => ({ x, y })),
  lines: [
    { a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, lengthM: 0.4282 },
    { a: { x: 0, y: 0 }, b: { x: 0, y: 100 }, lengthM: 0.0856 },
  ],
}

describe('history v2', () => {
  it('migrates a v1 file in memory and writes v2 at the next change', async () => {
    const v1Item = { id: 'old', mode: 'distance', distanceM: 1.2345, points: [P(0, 0, 0), P(1.2345, 0, 0)], unit: 'in', createdAt: '2026-10-01T10:00:00.000Z', note: 'Desk' }
    storage.set('measuresama:history', { version: 1, items: [v1Item] })
    const h = await fresh()
    expect(h.listHistory()).toEqual([v1Item])
    // Loading alone never rewrites the file.
    expect(JSON.parse(localStorage.getItem('measuresama:history')!).version).toBe(1)
    h.addFromArResult(AR_RESULTS.area)
    const file = JSON.parse(localStorage.getItem('measuresama:history')!)
    expect(file.version).toBe(2)
    expect(file.items.map((i: { id: string }) => i.id)).toContain('old')
    expect(file.items.find((i: { id: string }) => i.id === 'old')).toEqual(v1Item)
  })

  it.each(Object.values(AR_RESULTS))('saves and reloads a $mode result', async (r) => {
    const h = await fresh()
    const item = h.addFromArResult(r)
    const { cancelled: _c, screenshot, ...fields } = r as ArMeasurement & { cancelled: false }
    expect(item).toEqual({ ...fields, id: item.id, ...(screenshot ? { screenshotUri: screenshot.uri } : {}) })
    expect((await fresh()).listHistory()).toEqual([item])
  })

  it('saves a photo measurement', async () => {
    const h = await fresh()
    const item = h.addPhotoMeasurement({ unit: 'in', photo: PHOTO, screenshotUri: 'file:///x/p.jpg' })
    expect(item).toMatchObject({ mode: 'photo', unit: 'in', points: [], distanceM: 0.4282, photo: PHOTO, screenshotUri: 'file:///x/p.jpg' })
    expect(Number.isNaN(Date.parse(item.createdAt))).toBe(false)
    expect((await fresh()).listHistory()).toEqual([item])
    // Only file:// photos are kept; a photo without lines is refused.
    expect(h.addPhotoMeasurement({ unit: 'cm', photo: PHOTO, screenshotUri: 'https://evil.example/p.jpg' }).screenshotUri).toBeUndefined()
    expect(() => h.addPhotoMeasurement({ unit: 'cm', photo: { ...PHOTO, lines: [] } })).toThrow()
  })

  it('keeps valid items of every mode and drops ones missing what their mode needs', async () => {
    const at = '2026-01-01T00:00:00Z'
    const ok = [
      { id: 'd', mode: 'distance', distanceM: 1 },
      { id: 'p', mode: 'path', distanceM: 2, segmentsM: [1, 1] },
      { id: 'a', mode: 'area', areaM2: 1, perimeterM: 4 },
      { id: 'g', mode: 'angle', angleDeg: 180 },
      { id: 'h', mode: 'height', heightM: 2 },
      { id: 'v', mode: 'volume', lengthM: 1, widthM: 1, heightM: 1, volumeM3: 1 },
      { id: 'r', mode: 'room-plan', areaM2: 9, perimeterM: 12, segmentsM: [3, 3, 3, 3] },
      { id: 'f', mode: 'photo', distanceM: 99, points: [P(1, 1, 1)], photo: PHOTO },
    ]
    const bad = [
      { id: 'd-', mode: 'distance' },
      { id: 'p-', mode: 'path', distanceM: 2 },
      { id: 'p-seg', mode: 'path', distanceM: 2, segmentsM: [1, Number.NaN] },
      { id: 'a-', mode: 'area', areaM2: 1 },
      { id: 'a-neg', mode: 'area', areaM2: -1, perimeterM: 4 },
      { id: 'g-', mode: 'angle', angleDeg: 181 },
      { id: 'h-', mode: 'height', distanceM: 2 },
      { id: 'v-', mode: 'volume', lengthM: 1, widthM: 1, heightM: 1 },
      { id: 'r-', mode: 'room-plan', areaM2: 9, perimeterM: 12 },
      { id: 'f-none', mode: 'photo', distanceM: 1 },
      { id: 'f-nolines', mode: 'photo', photo: { ...PHOTO, lines: [] } },
      { id: 'f-badline', mode: 'photo', photo: { ...PHOTO, lines: [{ a: { x: 0, y: 0 }, b: { x: 'far', y: 0 }, lengthM: 1 }] } },
      { id: 'f-neglen', mode: 'photo', photo: { ...PHOTO, lines: [{ a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, lengthM: -1 }] } },
      { id: 'f-card', mode: 'photo', photo: { ...PHOTO, card: PHOTO.card.slice(0, 3) } },
    ]
    localStorage.setItem('measuresama:history', JSON.stringify({ version: 2, items: [...ok, ...bad].map((i) => ({ createdAt: at, ...i })) }))
    const items = (await fresh()).listHistory()
    expect(items.map((i) => i.id).sort()).toEqual(ok.map((i) => i.id).sort())
    // Photo items take their length from the first line and never keep AR points.
    expect(items.find((i) => i.id === 'f')).toMatchObject({ distanceM: 0.4282, points: [] })
  })

  it('drops photo URIs that are not file://', async () => {
    localStorage.setItem(
      'measuresama:history',
      JSON.stringify({ version: 2, items: [{ id: 'h', mode: 'height', heightM: 2, createdAt: '2026-01-01T00:00:00Z', screenshotUri: 'content://x' }] }),
    )
    expect((await fresh()).listHistory()[0].screenshotUri).toBeUndefined()
  })

  it('writes a CSV row for every mode', async () => {
    const h = await fresh()
    const t = (i: number) => `2026-10-0${i}T10:00:00.000Z`
    const modes = Object.values(AR_RESULTS)
    modes.forEach((r, i) => h.addFromArResult({ ...r, createdAt: t(i + 1) }))
    const photo = h.addPhotoMeasurement({ unit: 'cm', photo: PHOTO })
    h.setHistoryNote(photo.id, '=cmd')
    const csv = h.historyToCsv([...h.listHistory()].reverse())
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe(CSV_HEADER)
    expect(lines.slice(1)).toEqual([
      `${t(1)},distance,1.2345,1.23 m,cm,,,,,,,,,,no`,
      `${t(2)},path,2.5,2.50 m,cm,,,,,,,,1.0000; 1.5000,,no`,
      `${t(3)},area,,2.50 m²,cm,2.5,6.5,,,,,,2.0000; 1.2500; 2.0000; 1.2500,,yes`,
      `${t(4)},angle,,90.0°,cm,,,90,,,,,1.0000; 0.5000,,no`,
      `${t(5)},height,1.8,1.80 m,cm,,,,1.8,,,,,,no`,
      `${t(6)},volume,1,250 L,cm,0.5,,,0.5,0.5,0.25,,,,no`,
      `${t(7)},room-plan,,12.00 m²,cm,12,14,,,,,2.5,4.0000; 3.0000; 4.0000; 3.0000,,no`,
      `${photo.createdAt},photo,0.4282,42.8 cm,cm,,,,,,,,0.4282; 0.0856,'=cmd,no`,
    ])
  })
})
