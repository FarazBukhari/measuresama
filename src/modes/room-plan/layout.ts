import { planFromFloorPoints, type Point2D } from '../../lib/geometry'
import { formatLength, type LengthUnit } from '../../lib/units'
import type { HistoryItem } from '../../state/history'

/** One wall of the drawn plan: its number and length label, placed for drawing. */
export interface WallLabel {
  /** 1-based wall number (wall 1 runs from corner 1 to corner 2). */
  number: number
  /** Formatted length, e.g. "3.42 m". */
  text: string
  /** Centre of the length label, outside the room. */
  label: Point2D
  /** Centre of the wall number, inside the room. */
  badge: Point2D
}

/** The room plan fitted into a box, in the box's units (SVG units or mm). */
export interface RoomPlanLayout {
  corners: Point2D[]
  walls: WallLabel[]
  width: number
  height: number
}

export interface LayoutBox {
  width: number
  height: number
  /** Space kept free on every side for the labels. */
  pad: number
  /** Label font size, in box units. Used to keep labels clear of the walls. */
  fontSize: number
}

/** Wall lengths in metres: the saved ones when they match the corners, else measured from the points. */
export function wallLengths(item: Pick<HistoryItem, 'points' | 'segmentsM'>): number[] {
  const pts = item.points
  const n = pts.length
  const saved = item.segmentsM
  if (saved && saved.length === n && saved.every((m) => Number.isFinite(m) && m >= 0)) return [...saved]
  return pts.map((a, i) => {
    const b = pts[(i + 1) % n]
    return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  })
}

/**
 * Fit a room's floor corners (seen from above) into `box`, centred, with a length label outside
 * each wall and its number inside. Null when there are fewer than 3 corners.
 */
export function layoutRoomPlan(item: Pick<HistoryItem, 'points' | 'segmentsM'>, unit: LengthUnit, box: LayoutBox): RoomPlanLayout | null {
  if (item.points.length < 3) return null
  const plan = planFromFloorPoints(item.points)
  const lengths = wallLengths(item)
  const innerW = Math.max(box.width - 2 * box.pad, 1)
  const innerH = Math.max(box.height - 2 * box.pad, 1)
  const { width: w, height: h } = plan.bounds
  const scale = Math.min(w > 0 ? innerW / w : Infinity, h > 0 ? innerH / h : Infinity)
  const s = Number.isFinite(scale) ? scale : 1
  const offX = box.pad + (innerW - w * s) / 2
  const offY = box.pad + (innerH - h * s) / 2
  const corners = plan.points.map((p) => ({ x: offX + p.x * s, y: offY + p.y * s }))

  // Signed area tells which side of each wall is outside.
  let twice = 0
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length]
    twice += a.x * b.y - b.x * a.y
  })
  const side = twice < 0 ? -1 : 1

  const walls = corners.map((a, i) => {
    const b = corners[(i + 1) % corners.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = (side * dy) / len
    const ny = (side * -dx) / len
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const text = formatLength(lengths[i], unit)
    // Push the label out far enough that a horizontal label clears a wall at any angle.
    const halfW = (text.length * box.fontSize * 0.55) / 2
    const out = box.fontSize * 0.4 + halfW * Math.abs(nx) + box.fontSize * 0.6 * Math.abs(ny)
    const inside = box.fontSize * 1.1
    return {
      number: i + 1,
      text,
      label: { x: mid.x + nx * out, y: mid.y + ny * out },
      badge: { x: mid.x - nx * inside, y: mid.y - ny * inside },
    }
  })
  return { corners, walls, width: box.width, height: box.height }
}
