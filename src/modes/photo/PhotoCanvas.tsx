import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from 'react'
import { cn } from '../../lib/cn'
import type { Point2D } from '../../lib/geometry'
import type { DecodedPhoto } from './image'
import { Magnifier } from './Magnifier'

/** A line drawn on the photo, in image px. */
export interface DraftLine {
  a: Point2D
  b: Point2D
}

type Target = { kind: 'corner'; index: number } | { kind: 'line'; index: number; end: 'a' | 'b' }

interface Drag {
  target: Target
  pointerId: number
  /** Handle position minus finger position (image px), so a grabbed handle doesn't jump. */
  offset: Point2D
  /** A line being drawn right now: dropped on release if it is only a tap. */
  isNew: boolean
}

/** Lines shorter than this on screen (CSS px) are taps, not lines. */
const MIN_LINE_CSS_PX = 10

const CARD_COLOR = '#22d3ee'
const LINE_COLOR = '#facc15'
const BAD_COLOR = '#f87171'

interface Props {
  photo: DecodedPhoto
  /** The 4 card handles, in handle order. */
  corners: Point2D[]
  onCorners: Dispatch<SetStateAction<Point2D[]>>
  /** The fitted card (clockwise), or null while the corners don't make a usable card. */
  card: Point2D[] | null
  lines: DraftLine[]
  onLines: Dispatch<SetStateAction<DraftLine[]>>
  /** Length label of each line. */
  labels: string[]
  /** Dragging on the photo draws a line (only once the card is usable). */
  canDraw: boolean
  onCornerMoved: () => void
}

/**
 * The photo with the card outline, the lines, draggable handles (pointer + arrow keys) and a
 * magnifier while dragging. Coordinates are image px; the photo is scaled to fit the screen.
 */
export function PhotoCanvas({ photo, corners, onCorners, card, lines, onLines, labels, canDraw, onCornerMoved }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const holderRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const linesRef = useRef(lines)
  useLayoutEffect(() => {
    linesRef.current = lines
  }, [lines])
  const [loupe, setLoupe] = useState<{ point: Point2D; scale: number } | null>(null)
  const { width: w, height: h } = photo

  // Show the working canvas itself: no second copy of the pixels.
  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    holder.replaceChildren(photo.canvas)
    return () => holder.replaceChildren()
  }, [photo])

  const scaleNow = () => {
    const rect = wrapRef.current?.getBoundingClientRect()
    return rect && rect.width > 0 ? { rect, scale: rect.width / w } : null
  }

  const clamp = (p: Point2D): Point2D => ({ x: Math.min(w, Math.max(0, p.x)), y: Math.min(h, Math.max(0, p.y)) })

  const toImage = (e: PointerEvent): { p: Point2D; scale: number } | null => {
    const s = scaleNow()
    if (!s) return null
    return { p: { x: (e.clientX - s.rect.left) / s.scale, y: (e.clientY - s.rect.top) / s.scale }, scale: s.scale }
  }

  const place = (t: Target, p: Point2D) => {
    if (t.kind === 'corner') {
      onCorners((cs) => cs.map((c, i) => (i === t.index ? p : c)))
      onCornerMoved()
    } else {
      onLines((ls) => ls.map((l, i) => (i === t.index ? { ...l, [t.end]: p } : l)))
    }
  }

  const begin = (e: PointerEvent, target: Target, at: Point2D, isNew: boolean) => {
    const hit = toImage(e)
    if (!hit) return
    e.preventDefault()
    wrapRef.current?.setPointerCapture(e.pointerId)
    drag.current = { target, pointerId: e.pointerId, offset: { x: at.x - hit.p.x, y: at.y - hit.p.y }, isNew }
    setLoupe({ point: at, scale: hit.scale })
  }

  const onHandleDown = (target: Target, at: Point2D) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.stopPropagation()
    begin(e, target, at, false)
  }

  const onSurfaceDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canDraw || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    const hit = toImage(e)
    if (!hit) return
    const p = clamp(hit.p)
    const index = linesRef.current.length
    onLines((ls) => [...ls, { a: p, b: p }])
    begin(e, { kind: 'line', index, end: 'b' }, p, true)
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const hit = toImage(e)
    if (!hit) return
    const p = clamp({ x: hit.p.x + d.offset.x, y: hit.p.y + d.offset.y })
    place(d.target, p)
    setLoupe({ point: p, scale: hit.scale })
  }

  const onEnd = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    setLoupe(null)
    if (d.isNew && d.target.kind === 'line') {
      const line = linesRef.current[d.target.index]
      const scale = scaleNow()?.scale ?? 1
      if (!line || Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) * scale < MIN_LINE_CSS_PX) {
        const index = d.target.index
        onLines((ls) => ls.filter((_, i) => i !== index))
      }
    }
  }

  const onKey = (target: Target, at: Point2D) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 10 : 1
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const d = move[e.key]
    if (!d) return
    e.preventDefault()
    place(target, clamp({ x: at.x + d[0], y: at.y + d[1] }))
  }

  const pct = (p: Point2D) => ({ left: `${(p.x / w) * 100}%`, top: `${(p.y / h) * 100}%` })
  const outline = card ?? corners
  const polygon = outline.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div
      ref={wrapRef}
      className={cn('relative mx-auto select-none', canDraw && 'touch-none cursor-crosshair')}
      style={{ width: `min(100%, calc(62vh * ${w / h}))` }}
      onPointerDown={onSurfaceDown}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onLostPointerCapture={onEnd}
    >
      <div
        ref={holderRef}
        data-testid="photo-canvas"
        role="img"
        aria-label="Your photo"
        className="overflow-hidden rounded-md bg-muted [&>canvas]:block [&>canvas]:h-auto [&>canvas]:w-full"
      />

      <svg className="pointer-events-none absolute inset-0 size-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <polygon
          points={polygon}
          fill={card ? 'rgba(34, 211, 238, 0.15)' : 'rgba(248, 113, 113, 0.12)'}
          stroke={card ? CARD_COLOR : BAD_COLOR}
          strokeWidth={2}
          strokeDasharray={card ? undefined : '6 4'}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {lines.map((l, i) => (
          <g key={i}>
            <line x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke="rgba(0,0,0,0.7)" strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <line x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke={LINE_COLOR} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>

      {lines.map((l, i) => (
        <span
          key={i}
          data-testid="photo-line-length"
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-sm font-semibold whitespace-nowrap text-white tabular-nums"
          style={{ ...pct({ x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2 }), transform: 'translate(-50%, calc(-100% - 8px))' }}
        >
          {labels[i]}
        </span>
      ))}

      {corners.map((c, i) => (
        <Handle
          key={`c${i}`}
          label={`Card corner ${i + 1}`}
          point={c}
          style={pct(c)}
          color={card ? CARD_COLOR : BAD_COLOR}
          onPointerDown={onHandleDown({ kind: 'corner', index: i }, c)}
          onKeyDown={onKey({ kind: 'corner', index: i }, c)}
        />
      ))}
      {lines.flatMap((l, i) =>
        (['a', 'b'] as const).map((end) => (
          <Handle
            key={`l${i}${end}`}
            label={`Line ${i + 1} ${end === 'a' ? 'start' : 'end'}`}
            point={l[end]}
            style={pct(l[end])}
            color={LINE_COLOR}
            small
            onPointerDown={onHandleDown({ kind: 'line', index: i, end }, l[end])}
            onKeyDown={onKey({ kind: 'line', index: i, end }, l[end])}
          />
        )),
      )}

      {loupe && <Magnifier source={photo.canvas} point={loupe.point} scale={loupe.scale} />}
    </div>
  )
}

function Handle({
  label,
  point,
  style,
  color,
  small,
  onPointerDown,
  onKeyDown,
}: {
  label: string
  point: Point2D
  style: { left: string; top: string }
  color: string
  small?: boolean
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-x={point.x.toFixed(2)}
      data-y={point.y.toFixed(2)}
      className="absolute z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      style={style}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span
        aria-hidden="true"
        className={cn('rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]', small ? 'size-3.5' : 'size-5')}
        style={{ backgroundColor: color }}
      />
    </button>
  )
}
