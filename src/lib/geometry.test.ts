import { describe, expect, it } from 'vitest'
import { planFromFloorPoints, polygonArea3D, segmentLengths } from './geometry'

const p = (x: number, y: number, z: number) => ({ x, y, z })

describe('segmentLengths', () => {
  const pts = [p(0, 0, 0), p(3, 0, 0), p(3, 0, 4)]
  it('measures an open path', () => {
    expect(segmentLengths(pts, false)).toEqual([3, 4])
  })
  it('closes a shape back to the first point', () => {
    expect(segmentLengths(pts, true)).toEqual([3, 4, 5])
  })
  it('handles short input', () => {
    expect(segmentLengths([], true)).toEqual([])
    expect(segmentLengths([p(1, 1, 1)], false)).toEqual([])
    expect(segmentLengths([p(0, 0, 0), p(0, 2, 0)], true)).toEqual([2])
  })
})

describe('polygonArea3D', () => {
  it('measures a floor rectangle', () => {
    expect(polygonArea3D([p(0, 0, 0), p(2, 0, 0), p(2, 0, 1.25), p(0, 0, 1.25)])).toBeCloseTo(2.5, 10)
  })
  it('measures a wall and ignores the winding', () => {
    const wall = [p(0, 0, 0), p(0, 2, 0), p(3, 2, 0), p(3, 0, 0)]
    expect(polygonArea3D(wall)).toBeCloseTo(6, 10)
    expect(polygonArea3D([...wall].reverse())).toBeCloseTo(6, 10)
  })
  it('measures a tilted triangle', () => {
    // Right triangle with legs 1 and √2, on a 45° slope.
    expect(polygonArea3D([p(0, 0, 0), p(1, 0, 0), p(1, 1, 1)])).toBeCloseTo(Math.SQRT2 / 2, 10)
  })
  it('measures an L-shaped room', () => {
    const l = [p(0, 0, 0), p(4, 0, 0), p(4, 0, 2), p(2, 0, 2), p(2, 0, 3), p(0, 0, 3)]
    expect(polygonArea3D(l)).toBeCloseTo(10, 10)
  })
  it('gives 0 for too few points or a line', () => {
    expect(polygonArea3D([p(0, 0, 0), p(1, 0, 0)])).toBe(0)
    expect(polygonArea3D([p(0, 0, 0), p(1, 0, 0), p(2, 0, 0)])).toBe(0)
  })
})

describe('planFromFloorPoints', () => {
  it('turns wall 1 flat and shifts to 0', () => {
    // A 2 × 1 m room whose first wall runs along world z, away from x = 5.
    const plan = planFromFloorPoints([p(5, 0, 0), p(5, 0, 2), p(4, 0, 2), p(4, 0, 0)])
    expect(plan.points[0].y).toBeCloseTo(plan.points[1].y, 10)
    expect(Math.min(...plan.points.map((q) => q.x))).toBeCloseTo(0, 10)
    expect(Math.min(...plan.points.map((q) => q.y))).toBeCloseTo(0, 10)
    expect(plan.bounds.width).toBeCloseTo(2, 10)
    expect(plan.bounds.height).toBeCloseTo(1, 10)
    expect(plan.points[1].x - plan.points[0].x).toBeCloseTo(2, 10)
  })
  it('keeps the floor height out of the plan', () => {
    const plan = planFromFloorPoints([p(0, -1.4, 0), p(3, -1.4, 0), p(3, -1.4, 4)])
    expect(plan.points).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
    ])
    expect(plan.bounds).toEqual({ width: 3, height: 4 })
  })
  it('handles empty and single-point input', () => {
    expect(planFromFloorPoints([])).toEqual({ points: [], bounds: { width: 0, height: 0 } })
    expect(planFromFloorPoints([p(2, 0, 3)])).toEqual({ points: [{ x: 0, y: 0 }], bounds: { width: 0, height: 0 } })
  })
})
