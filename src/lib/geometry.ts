import type { ArPoint } from '../plugins/ar-measure/definitions'

/** A point on a flat drawing or a photo. */
export interface Point2D {
  x: number
  y: number
}

const dist = (a: ArPoint, b: ArPoint) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)

/** Lengths between consecutive points; `closed` adds the side from the last point back to the first (3+ points). */
export function segmentLengths(points: readonly ArPoint[], closed: boolean): number[] {
  const out: number[] = []
  for (let i = 1; i < points.length; i++) out.push(dist(points[i - 1], points[i]))
  if (closed && points.length > 2) out.push(dist(points[points.length - 1], points[0]))
  return out
}

/**
 * Area of a polygon in 3D: Newell's normal gives the plane, then the shoelace formula runs in a
 * 2D basis of that plane (as the native side does). 0 for fewer than 3 points or a degenerate shape.
 */
export function polygonArea3D(points: readonly ArPoint[]): number {
  const n = points.length
  if (n < 3) return 0
  let nx = 0
  let ny = 0
  let nz = 0
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    nx += (a.y - b.y) * (a.z + b.z)
    ny += (a.z - b.z) * (a.x + b.x)
    nz += (a.x - b.x) * (a.y + b.y)
  }
  const len = Math.hypot(nx, ny, nz)
  if (!(len > 0)) return 0
  const normal = { x: nx / len, y: ny / len, z: nz / len }
  // u: any unit vector in the plane; v = normal × u.
  const seed = Math.abs(normal.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const d = seed.x * normal.x + seed.y * normal.y + seed.z * normal.z
  const ux = seed.x - d * normal.x
  const uy = seed.y - d * normal.y
  const uz = seed.z - d * normal.z
  const ul = Math.hypot(ux, uy, uz)
  const u = { x: ux / ul, y: uy / ul, z: uz / ul }
  const v = { x: normal.y * u.z - normal.z * u.y, y: normal.z * u.x - normal.x * u.z, z: normal.x * u.y - normal.y * u.x }
  const flat = points.map((p) => ({ x: p.x * u.x + p.y * u.y + p.z * u.z, y: p.x * v.x + p.y * v.y + p.z * v.z }))
  let twice = 0
  for (let i = 0; i < n; i++) {
    const a = flat[i]
    const b = flat[(i + 1) % n]
    twice += a.x * b.y - b.x * a.y
  }
  return Math.abs(twice) / 2
}

export interface FloorPlan {
  /** Corners in metres, seen from above: x = world x, y = world z, rotated and shifted. */
  points: Point2D[]
  /** Size of the plan in metres (the smallest x and y are 0). */
  bounds: { width: number; height: number }
}

/**
 * A top-down plan from floor corners: world (x, z) turned so wall 1 (corner 1 → 2) runs
 * along +x, then shifted so the smallest x and y are 0.
 */
export function planFromFloorPoints(points: readonly ArPoint[]): FloorPlan {
  if (points.length === 0) return { points: [], bounds: { width: 0, height: 0 } }
  const flat = points.map((p) => ({ x: p.x, y: p.z }))
  let angle = 0
  if (flat.length > 1) {
    const dx = flat[1].x - flat[0].x
    const dy = flat[1].y - flat[0].y
    if (dx !== 0 || dy !== 0) angle = Math.atan2(dy, dx)
  }
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  const turned = flat.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }))
  const minX = Math.min(...turned.map((p) => p.x))
  const minY = Math.min(...turned.map((p) => p.y))
  const shifted = turned.map((p) => ({ x: p.x - minX, y: p.y - minY }))
  return {
    points: shifted,
    bounds: { width: Math.max(...shifted.map((p) => p.x)), height: Math.max(...shifted.map((p) => p.y)) },
  }
}
