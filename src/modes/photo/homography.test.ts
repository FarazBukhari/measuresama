import { describe, expect, it } from 'vitest'
import type { Point2D } from '../../lib/geometry'
import {
  applyHomography,
  cardRectangle,
  fitCard,
  isConvexQuad,
  isUsableQuad,
  longSideIsFirst,
  measureMm,
  orderClockwise,
  solveHomography,
  type Homography,
} from './homography'

const p = (x: number, y: number): Point2D => ({ x, y })

describe('orderClockwise', () => {
  it('starts at the top-left corner and goes clockwise on screen', () => {
    const shuffled = [p(300, 220), p(100, 100), p(100, 220), p(300, 100)]
    expect(orderClockwise(shuffled)).toEqual([p(100, 100), p(300, 100), p(300, 220), p(100, 220)])
  })

  it('handles a tilted quad and does not change the input', () => {
    const input = [p(50, 200), p(200, 40), p(380, 190), p(230, 350)]
    const copy = input.map((q) => ({ ...q }))
    expect(orderClockwise(input)).toEqual([p(200, 40), p(380, 190), p(230, 350), p(50, 200)])
    expect(input).toEqual(copy)
  })
})

describe('convexity', () => {
  it('accepts a convex quad in either direction', () => {
    const q = [p(0, 0), p(10, 0), p(10, 5), p(0, 5)]
    expect(isConvexQuad(q)).toBe(true)
    expect(isConvexQuad([...q].reverse())).toBe(true)
  })

  it('rejects a bow tie, a dent, a straight corner and the wrong count', () => {
    expect(isConvexQuad([p(0, 0), p(10, 5), p(10, 0), p(0, 5)])).toBe(false)
    expect(isConvexQuad([p(0, 0), p(10, 0), p(5, 2), p(5, 10)])).toBe(false)
    expect(isConvexQuad([p(0, 0), p(5, 0), p(10, 0), p(5, 5)])).toBe(false)
    expect(isConvexQuad([p(0, 0), p(10, 0), p(10, 5)])).toBe(false)
  })

  it('needs a card big enough to measure with', () => {
    expect(isUsableQuad([p(0, 0), p(200, 0), p(200, 120), p(0, 120)])).toBe(true)
    expect(isUsableQuad([p(0, 0), p(8, 0), p(8, 5), p(0, 5)])).toBe(false)
  })
})

describe('long side', () => {
  it('picks the pair of opposite sides that look longer', () => {
    const wide = [p(0, 0), p(856, 0), p(856, 540), p(0, 540)]
    const tall = [p(0, 0), p(540, 0), p(540, 856), p(0, 856)]
    expect(longSideIsFirst(wide)).toBe(true)
    expect(longSideIsFirst(tall)).toBe(false)
    expect(fitCard(tall)?.longIsFirst).toBe(false)
    expect(fitCard(tall, true)?.longIsFirst).toBe(true)
  })

  it('makes an ID-1 card rectangle either way round', () => {
    expect(cardRectangle(true)[2]).toEqual(p(85.6, 53.98))
    expect(cardRectangle(false)[2]).toEqual(p(53.98, 85.6))
  })
})

describe('solveHomography', () => {
  it('maps the 4 points exactly (scale only)', () => {
    const src = [p(100, 100), p(956, 100), p(956, 640), p(100, 640)]
    const H = solveHomography(src, cardRectangle(true))!
    expect(H).not.toBeNull()
    src.forEach((s, i) => {
      const m = applyHomography(H, s)
      expect(m.x).toBeCloseTo(cardRectangle(true)[i].x, 9)
      expect(m.y).toBeCloseTo(cardRectangle(true)[i].y, 9)
    })
    // 10 px per mm: a 1000 px line is 100 mm.
    expect(measureMm(H, p(100, 800), p(1100, 800))).toBeCloseTo(100, 6)
  })

  it('gives the identity for the same points', () => {
    const q = [p(0, 0), p(4, 0), p(4, 3), p(0, 3)]
    const H = solveHomography(q, q)!
    expect(applyHomography(H, p(1.5, 2.25)).x).toBeCloseTo(1.5, 9)
    expect(applyHomography(H, p(1.5, 2.25)).y).toBeCloseTo(2.25, 9)
  })

  it('recovers real lengths from a photo taken at an angle', () => {
    // A known camera: mm on the table → image px, with perspective.
    const G: Homography = [8, 1.5, 300, 0.4, 7, 200, 0.0006, 0.0009, 1]
    const card = cardRectangle(true).map((q) => applyHomography(G, q))
    // Corners handed over in a scrambled order, as handles can be.
    const fit = fitCard([card[2], card[0], card[3], card[1]])!
    expect(fit).not.toBeNull()
    expect(fit.longIsFirst).toBe(true)
    const a = applyHomography(G, p(10, 70))
    const b = applyHomography(G, p(110, 70))
    expect(Math.abs(measureMm(fit.H, a, b) - 100)).toBeLessThan(0.1)
    const c = applyHomography(G, p(120, -20))
    const d = applyHomography(G, p(150, 20))
    expect(Math.abs(measureMm(fit.H, c, d) - 50)).toBeLessThan(0.1)
  })

  it('returns null for degenerate input', () => {
    const rect = cardRectangle(true)
    expect(solveHomography([p(0, 0), p(5, 0), p(10, 0), p(3, 4)], rect)).toBeNull()
    expect(solveHomography([p(1, 1), p(1, 1), p(1, 1), p(1, 1)], rect)).toBeNull()
    expect(solveHomography([p(0, 0), p(1, 0)], rect)).toBeNull()
    expect(fitCard([p(0, 0), p(5, 0), p(10, 0), p(3, 4)])).toBeNull()
  })
})
