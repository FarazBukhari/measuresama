import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HistoryItem } from '../../state/history'
import { layoutRoomPlan, wallLengths } from './layout'

const download = vi.hoisted(() => ({ downloadBlob: vi.fn(async () => ({ method: 'download' as const })) }))
vi.mock('../../lib/download', () => download)

const { buildRoomPlanPdf, exportRoomPlanPdf, pdfSafe, roomPlanPdfContent } = await import('./pdf')

/** A 4 m × 3 m room, corners on the floor (y = 0). */
const ROOM: HistoryItem = {
  id: 'room-1',
  mode: 'room-plan',
  unit: 'cm',
  createdAt: '2026-11-06T12:00:00.000Z',
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 0, z: 3 },
    { x: 0, y: 0, z: 3 },
  ],
  segmentsM: [4, 3, 4, 3],
  perimeterM: 14,
  areaM2: 12,
  wallHeightM: 2.5,
  distanceM: 14,
}

async function blobText(blob: Blob): Promise<string> {
  const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(blob)
  })
  return new TextDecoder('latin1').decode(buf)
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('room plan layout', () => {
  it('fits the room in the box, centred, with labels outside and numbers inside', () => {
    const plan = layoutRoomPlan(ROOM, 'cm', { width: 200, height: 200, pad: 20, fontSize: 4 })!
    expect(plan.corners).toHaveLength(4)
    const xs = plan.corners.map((c) => c.x)
    const ys = plan.corners.map((c) => c.y)
    // 4 m wide fills the 160 inner width; 3 m tall is 120, centred vertically.
    expect(Math.min(...xs)).toBeCloseTo(20)
    expect(Math.max(...xs)).toBeCloseTo(180)
    expect(Math.min(...ys)).toBeCloseTo(40)
    expect(Math.max(...ys)).toBeCloseTo(160)
    expect(plan.walls.map((w) => [w.number, w.text])).toEqual([
      [1, '4.00 m'],
      [2, '3.00 m'],
      [3, '4.00 m'],
      [4, '3.00 m'],
    ])
    const inside = (p: { x: number; y: number }) => p.x > 20 && p.x < 180 && p.y > 40 && p.y < 160
    for (const w of plan.walls) {
      expect(inside(w.label)).toBe(false)
      expect(inside(w.badge)).toBe(true)
    }
  })

  it('needs 3 corners, and measures walls from the points when the saved ones do not match', () => {
    expect(layoutRoomPlan({ points: ROOM.points.slice(0, 2) }, 'cm', { width: 100, height: 100, pad: 10, fontSize: 4 })).toBeNull()
    expect(wallLengths({ points: ROOM.points, segmentsM: [1, 2] })).toEqual([4, 3, 4, 3])
  })
})

describe('room plan PDF', () => {
  it('lists the walls and the totals', () => {
    const c = roomPlanPdfContent(ROOM, 'cm')
    expect(c.title).toBe('Room plan')
    expect(c.walls).toEqual([
      ['Wall 1', '4.00 m'],
      ['Wall 2', '3.00 m'],
      ['Wall 3', '4.00 m'],
      ['Wall 4', '3.00 m'],
    ])
    expect(c.stats).toEqual([
      ['Floor area', '12.00 m²'],
      ['Perimeter', '14.00 m'],
      ['Wall height', '2.50 m'],
    ])
    const { wallHeightM: _, ...noHeight } = ROOM
    expect(roomPlanPdfContent(noHeight, 'in').stats.map(([l]) => l)).toEqual(['Floor area', 'Perimeter'])
  })

  it('keeps text printable in the built-in PDF font', () => {
    expect(pdfSafe('6 Nov 2026, 2:05\u202fPM')).toBe('6 Nov 2026, 2:05 PM')
    expect(pdfSafe('12.00 m² · 3 × 4 — ok…')).toBe('12.00 m² · 3 × 4 - ok...')
    expect(pdfSafe('a\u{1F4CF}b')).toBe('ab')
  })

  it('builds an A4 PDF', async () => {
    const blob = await buildRoomPlanPdf(ROOM, 'cm')
    expect(blob.type).toBe('application/pdf')
    const text = await blobText(blob)
    expect(text.startsWith('%PDF-')).toBe(true)
    expect(text).toContain('Room plan')
    expect(text).toContain('Wall 4')
    // ² is in the font's Latin-1 set, so it is written as itself, not swapped.
    expect(text).toContain('12.00 m²')
    expect(text).toMatch(/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/)
    expect(text).not.toMatch(/https?:\/\/(?!www\.w3\.org|ns\.adobe\.com|purl\.org)/)
  })

  it('saves through download.ts with a dated file name', async () => {
    await exportRoomPlanPdf(ROOM, 'cm')
    expect(download.downloadBlob).toHaveBeenCalledTimes(1)
    const [blob, name] = download.downloadBlob.mock.calls[0] as unknown as [Blob, string]
    expect(blob.type).toBe('application/pdf')
    expect(name).toMatch(/^room-plan-\d{4}-\d{2}-\d{2}\.pdf$/)
  })
})
