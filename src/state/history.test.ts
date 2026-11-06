import { Capacitor } from '@capacitor/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArMeasurement } from '../plugins/ar-measure/definitions'

const deleteFile = vi.fn(async (_opts: { path: string }) => undefined)
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { deleteFile } }))
const downloadText = vi.fn(async (_text: string, _name: string, _mime?: string) => ({ method: 'download' as const }))
vi.mock('../lib/download', () => ({ downloadText }))

async function fresh() {
  vi.resetModules()
  return import('./history')
}

function measurement(over: Partial<ArMeasurement> = {}): ArMeasurement {
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
    expect(JSON.parse(raw)).toMatchObject({ version: 1, items: [{ screenshotUri: 'file:///data/user/0/x/files/measurements/a.jpg' }] })
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
    localStorage.setItem('measuresama:history', JSON.stringify({ version: 2, items: [{ id: 'x' }] }))
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
    expect(lines[0]).toBe('Date,Mode,Length (m),Length,Unit,Area (m²),Note,Photo')
    expect(lines[1]).toBe('2026-11-01T10:00:00.000Z,distance,1.2345,4 ft 0.6 in,in,,"Desk, ""big"" one",no')
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
    expect(json).toMatchObject({ app: 'Measure Sama', version: 1, items: [{ distanceM: 1.2345 }] })
  })
})
