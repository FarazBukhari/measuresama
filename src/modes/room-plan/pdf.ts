import { downloadBlob, type SaveResult } from '../../lib/download'
import { formatDateTime } from '../../lib/format'
import { formatArea, formatLength, type LengthUnit } from '../../lib/units'
import type { HistoryItem } from '../../state/history'
import { layoutRoomPlan, wallLengths, type RoomPlanLayout } from './layout'

/** A4 portrait, in millimetres. */
const PAGE = { width: 210, height: 297, margin: 18 }
const PLAN_BOX = { top: 40, height: 125 }
const LABEL_PT = 9
const PT_TO_MM = 25.4 / 72

/**
 * The PDF's built-in Helvetica only has Latin-1 letters (², ³, ×, · and ° are fine). Swap the few
 * other characters dates and labels can contain, so nothing prints as junk.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/[\u2000-\u200b\u202f\u00a0]/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[^\u0020-\u00ff]/g, '')
}

/** Everything the PDF shows, worked out without jsPDF so it can be tested on its own. */
export interface RoomPlanPdfContent {
  title: string
  date: string
  plan: RoomPlanLayout | null
  /** "Wall 1", "3.42 m" … */
  walls: [string, string][]
  /** Floor area, perimeter and (if measured) wall height. */
  stats: [string, string][]
}

export function roomPlanPdfContent(item: HistoryItem, unit: LengthUnit): RoomPlanPdfContent {
  const innerW = PAGE.width - 2 * PAGE.margin
  const plan = layoutRoomPlan(item, unit, { width: innerW, height: PLAN_BOX.height, pad: 14, fontSize: LABEL_PT * PT_TO_MM })
  const lengths = item.points.length >= 3 ? wallLengths(item) : (item.segmentsM ?? [])
  const stats: [string, string][] = [
    ['Floor area', formatArea(item.areaM2 ?? Number.NaN, unit)],
    ['Perimeter', formatLength(item.perimeterM, unit)],
  ]
  if (item.wallHeightM !== undefined) stats.push(['Wall height', formatLength(item.wallHeightM, unit)])
  return {
    title: 'Room plan',
    date: formatDateTime(item.createdAt),
    plan,
    walls: lengths.map((m, i) => [`Wall ${i + 1}`, formatLength(m, unit)]),
    stats,
  }
}

/** The room plan as an A4 PDF. jsPDF loads only now, so it stays out of the main bundle. Never fetches anything. */
export async function buildRoomPlanPdf(item: HistoryItem, unit: LengthUnit): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const c = roomPlanPdfContent(item, unit)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  doc.setProperties({ title: c.title, creator: 'Measure Sama' })
  const left = PAGE.margin
  const right = PAGE.width - PAGE.margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(c.title, left, 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(pdfSafe(c.date), left, 31)
  doc.setTextColor(0)

  if (c.plan) {
    const ox = left
    const oy = PLAN_BOX.top
    const pts = c.plan.corners.map((p) => ({ x: ox + p.x, y: oy + p.y }))
    const deltas = pts.slice(1).map((p, i) => [p.x - pts[i].x, p.y - pts[i].y])
    // Tape palette: ink outline on a pale tape-yellow floor; yellow wall badges with ink numbers.
    doc.setDrawColor(20, 20, 20)
    doc.setFillColor(255, 238, 191)
    doc.setLineWidth(0.7)
    doc.lines(deltas, pts[0].x, pts[0].y, [1, 1], 'FD', true)
    doc.setFontSize(LABEL_PT)
    for (const w of c.plan.walls) {
      doc.setFillColor(255, 198, 41)
      doc.setLineWidth(0.3)
      doc.circle(ox + w.badge.x, oy + w.badge.y, 2.4, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(20, 20, 20)
      doc.text(String(w.number), ox + w.badge.x, oy + w.badge.y, { align: 'center', baseline: 'middle' })
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0)
      doc.text(pdfSafe(w.text), ox + w.label.x, oy + w.label.y, { align: 'center', baseline: 'middle' })
    }
  }

  let y = PLAN_BOX.top + PLAN_BOX.height + 12
  const row = (label: string, value: string, x: number, width: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(pdfSafe(label), x, y)
    doc.text(pdfSafe(value), x + width, y, { align: 'right' })
  }
  const nextLine = (step: number) => {
    y += step
    if (y > PAGE.height - PAGE.margin) {
      doc.addPage()
      y = 24
    }
  }

  doc.setFontSize(12)
  for (const [label, value] of c.stats) {
    row(label, value, left, right - left, true)
    nextLine(7)
  }
  nextLine(4)
  doc.setFontSize(11)
  // Two columns of walls.
  const colW = (right - left - 10) / 2
  for (let i = 0; i < c.walls.length; i += 2) {
    row(c.walls[i][0], c.walls[i][1], left, colW)
    if (c.walls[i + 1]) row(c.walls[i + 1][0], c.walls[i + 1][1], left + colW + 10, colW)
    nextLine(6)
  }
  return doc.output('blob')
}

const stamp = (d = new Date()) => d.toISOString().slice(0, 10)

/** Save the room plan PDF (download in the browser, Documents › Measure Sama in the app). */
export async function exportRoomPlanPdf(item: HistoryItem, unit: LengthUnit): Promise<SaveResult> {
  const blob = await buildRoomPlanPdf(item, unit)
  return downloadBlob(blob, `room-plan-${stamp()}.pdf`)
}
