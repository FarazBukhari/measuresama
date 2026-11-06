import { useEffect, useRef } from 'react'
import type { Point2D } from '../../lib/geometry'

/** Size of the loupe on screen (CSS px) and how much it enlarges what is shown on screen. */
export const MAGNIFIER_SIZE = 120
const ZOOM = 3
/** Gap between the finger and the loupe, so the finger never covers it. */
const OFFSET = 96

/**
 * A round loupe that shows the photo under the finger, enlarged 3×, with a crosshair. It sits
 * above the finger (below it near the top edge). Purely visual: hidden from screen readers.
 */
export function Magnifier({ source, point, scale }: { source: HTMLCanvasElement; point: Point2D; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !(scale > 0)) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const px = Math.round(MAGNIFIER_SIZE * dpr)
    if (canvas.width !== px) {
      canvas.width = px
      canvas.height = px
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Image px shown across the loupe: what MAGNIFIER_SIZE / ZOOM CSS px cover on screen.
    const span = MAGNIFIER_SIZE / ZOOM / scale
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, px, px)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(source, point.x - span / 2, point.y - span / 2, span, span, 0, 0, px, px)
    const mid = px / 2
    const arm = px * 0.16
    ctx.lineCap = 'round'
    for (const [color, w] of [
      ['rgba(0, 0, 0, 0.8)', 4 * dpr],
      ['#facc15', 1.5 * dpr],
    ] as const) {
      ctx.strokeStyle = color
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(mid - arm, mid)
      ctx.lineTo(mid + arm, mid)
      ctx.moveTo(mid, mid - arm)
      ctx.lineTo(mid, mid + arm)
      ctx.stroke()
    }
  }, [source, point.x, point.y, scale])

  const x = point.x * scale
  const y = point.y * scale
  const above = y - OFFSET - MAGNIFIER_SIZE / 2 >= 0
  const top = above ? y - OFFSET - MAGNIFIER_SIZE / 2 : y + OFFSET - MAGNIFIER_SIZE / 2
  return (
    <canvas
      ref={ref}
      data-testid="magnifier"
      aria-hidden="true"
      className="pointer-events-none absolute z-20 rounded-full border-2 border-white shadow-lg ring-1 ring-black/40"
      style={{ width: MAGNIFIER_SIZE, height: MAGNIFIER_SIZE, left: x - MAGNIFIER_SIZE / 2, top }}
    />
  )
}
