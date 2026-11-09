import type { Point2D } from '../../lib/geometry'
import { CARD_HEIGHT_MM, CARD_WIDTH_MM } from '../screen-ruler/screen-ruler'

/**
 * Photo measure maths. A bank card (ISO/IEC 7810 ID-1, 85.60 × 53.98 mm) lying flat gives four
 * known points, so a homography (a 3×3 projective map) turns image pixels on the card's plane
 * into millimetres. Everything here is pure and works in image pixels and millimetres.
 */

/** Row-major 3×3 matrix [h0..h8]: x' = (h0 x + h1 y + h2) / (h6 x + h7 y + h8), y' likewise with h3..h5. */
export type Homography = readonly number[]

export const CARD_LONG_MM = CARD_WIDTH_MM
export const CARD_SHORT_MM = CARD_HEIGHT_MM

/** The same points, clockwise on screen (y points down), starting with the top-left one (smallest x + y). */
export function orderClockwise(points: readonly Point2D[]): Point2D[] {
  if (points.length === 0) return []
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length
  const sorted = points.map(({ x, y }) => ({ x, y })).sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
  let start = 0
  for (let i = 1; i < sorted.length; i++) if (sorted[i].x + sorted[i].y < sorted[start].x + sorted[start].y) start = i
  return [...sorted.slice(start), ...sorted.slice(0, start)]
}

const cross = (o: Point2D, a: Point2D, b: Point2D) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
const dist = (a: Point2D, b: Point2D) => Math.hypot(b.x - a.x, b.y - a.y)

/** True when the 4 points, in this order, make a convex quadrilateral (every turn the same way, none straight). */
export function isConvexQuad(q: readonly Point2D[]): boolean {
  if (q.length !== 4 || !q.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return false
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const c = cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4])
    if (c === 0) return false
    const s = Math.sign(c)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

/** Area of a simple polygon (shoelace), always positive. */
export function polygonArea(q: readonly Point2D[]): number {
  let twice = 0
  for (let i = 0; i < q.length; i++) {
    const a = q[i]
    const b = q[(i + 1) % q.length]
    twice += a.x * b.y - b.x * a.y
  }
  return Math.abs(twice) / 2
}

/** Shorter than this (image px) on any side, the card is too small to measure with. */
export const MIN_CARD_SIDE_PX = 12

/** Convex, and big enough that a few pixels of error don't wreck the scale. */
export function isUsableQuad(q: readonly Point2D[]): boolean {
  if (!isConvexQuad(q)) return false
  for (let i = 0; i < 4; i++) if (dist(q[i], q[(i + 1) % 4]) < MIN_CARD_SIDE_PX) return false
  return true
}

/** True when sides 1 and 3 (corner 1→2 and 3→4) look longer in the image than sides 2 and 4. */
export function longSideIsFirst(q: readonly Point2D[]): boolean {
  return dist(q[0], q[1]) + dist(q[2], q[3]) >= dist(q[1], q[2]) + dist(q[3], q[0])
}

/** The card in millimetres, clockwise from (0, 0). `longIsFirst`: the first side is the 85.60 mm one. */
export function cardRectangle(longIsFirst: boolean): Point2D[] {
  const w = longIsFirst ? CARD_LONG_MM : CARD_SHORT_MM
  const h = longIsFirst ? CARD_SHORT_MM : CARD_LONG_MM
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]
}

/** Solve A x = b (n×n) by Gaussian elimination with partial pivoting. Null if A is (nearly) singular. */
function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length
  const m = a.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    if (!(Math.abs(m[pivot][col]) > 1e-10)) return null
    if (pivot !== col) [m[pivot], m[col]] = [m[col], m[pivot]]
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / m[col][col]
      if (f === 0) continue
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r][n]
    for (let c = r + 1; c < n; c++) s -= m[r][c] * x[c]
    x[r] = s / m[r][r]
  }
  return x.every(Number.isFinite) ? x : null
}

/** Move the points' centre to 0 and scale their mean distance to √2 (Hartley), which keeps the 8×8 system well conditioned. */
function normalization(points: readonly Point2D[]): { s: number; cx: number; cy: number } | null {
  const cx = points.reduce((t, p) => t + p.x, 0) / points.length
  const cy = points.reduce((t, p) => t + p.y, 0) / points.length
  const mean = points.reduce((t, p) => t + Math.hypot(p.x - cx, p.y - cy), 0) / points.length
  if (!(mean > 1e-12) || !Number.isFinite(mean)) return null
  return { s: Math.SQRT2 / mean, cx, cy }
}

/**
 * The homography that maps each src[i] onto dst[i] (4 pairs), via the 8×8 linear system with
 * h8 = 1. Null when the points are degenerate (repeated, or 3 in a line).
 */
export function solveHomography(src: readonly Point2D[], dst: readonly Point2D[]): Homography | null {
  if (src.length !== 4 || dst.length !== 4) return null
  const ns = normalization(src)
  const nd = normalization(dst)
  if (!ns || !nd) return null
  const a: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const x = (src[i].x - ns.cx) * ns.s
    const y = (src[i].y - ns.cy) * ns.s
    const u = (dst[i].x - nd.cx) * nd.s
    const v = (dst[i].y - nd.cy) * nd.s
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const h = solveLinear(a, b)
  if (!h) return null
  const hn = [...h, 1]
  // H = Tdst⁻¹ · Hn · Tsrc, with T = [s 0 -s·cx; 0 s -s·cy; 0 0 1].
  const ts = [ns.s, 0, -ns.s * ns.cx, 0, ns.s, -ns.s * ns.cy, 0, 0, 1]
  const tdInv = [1 / nd.s, 0, nd.cx, 0, 1 / nd.s, nd.cy, 0, 0, 1]
  const out = mul3(tdInv, mul3(hn, ts))
  const k = out[8]
  if (!(Math.abs(k) > 1e-15)) return null
  const H = out.map((v) => v / k)
  return H.every(Number.isFinite) ? H : null
}

function mul3(p: readonly number[], q: readonly number[]): number[] {
  const r = new Array<number>(9).fill(0)
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += p[i * 3 + k] * q[k * 3 + j]
  return r
}

export function applyHomography(H: Homography, p: Point2D): Point2D {
  const w = H[6] * p.x + H[7] * p.y + H[8]
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w }
}

/** Real distance in millimetres between two image points on the card's plane. */
export function measureMm(H: Homography, a: Point2D, b: Point2D): number {
  return dist(applyHomography(H, a), applyHomography(H, b))
}

export interface CardFit {
  /** The corners clockwise from top-left (image px), as stored with the measurement. */
  card: Point2D[]
  /** Image px → mm. */
  H: Homography
  longIsFirst: boolean
}

/**
 * Fit the card to 4 corner handles in any order. The long side is the pair of opposite sides that
 * look longer in the photo; `swapped` flips that (for strong perspective). Null if the quad can't be used.
 */
export function fitCard(corners: readonly Point2D[], swapped = false): CardFit | null {
  if (corners.length !== 4) return null
  const card = orderClockwise(corners)
  if (!isUsableQuad(card)) return null
  const longIsFirst = longSideIsFirst(card) !== swapped
  const H = solveHomography(card, cardRectangle(longIsFirst))
  return H ? { card, H, longIsFirst } : null
}
