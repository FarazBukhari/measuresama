import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { TapeReadout } from '../../components/ui'
import { cn } from '../../lib/cn'
import { formatInchFraction, formatMetric, MM_PER_INCH, rulerTicks, type Tick } from './screen-ruler'

/** Marker positions in millimetres from the ruler's zero. */
export type Markers = [number, number]

export interface RulerProps {
  pxPerMm: number
  orientation: 'horizontal' | 'vertical'
  markers: Markers
  onMarkersChange: (markers: Markers) => void
  /** Show the distance between the markers inside the ruler (full-screen mode). */
  readout?: boolean
  className?: string
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    update()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** Centre the 44px handle on its line, but slide it inwards near the ends. */
const handleShift = (pos: number, length: number) => (pos < 22 ? `${-pos}px` : pos > length - 22 ? `${length - pos - 44}px` : '-50%')
const LETTERS = ['A', 'B'] as const

/**
 * A ruler drawn at real scale: centimetres along one edge, inches along the other, with two
 * draggable markers (also keyboard sliders) that measure the distance between them.
 */
export function Ruler({ pxPerMm, orientation, markers, onMarkersChange, readout, className }: RulerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSize(ref)
  const vertical = orientation === 'vertical'
  const length = vertical ? height : width
  const cross = vertical ? width : height
  const lengthMm = length / pxPerMm
  const metric = useMemo(() => rulerTicks(length, pxPerMm, 'metric'), [length, pxPerMm])
  const imperial = useMemo(() => rulerTicks(length, pxPerMm, 'imperial'), [length, pxPerMm])
  const tickMax = Math.min(cross * 0.3, 44)
  const dragging = useRef<0 | 1 | null>(null)

  const shown: Markers = [clamp(markers[0], 0, lengthMm || 0), clamp(markers[1], 0, lengthMm || 0)]
  const distanceMm = Math.abs(shown[1] - shown[0])

  // A saved marker can lie beyond a shorter ruler (rotation, smaller window): pull it back in.
  const outside = length > 0 && (shown[0] !== markers[0] || shown[1] !== markers[1])
  useEffect(() => {
    if (outside) onMarkersChange(shown)
  })

  const move = (index: 0 | 1, mm: number) => {
    const next: Markers = [...shown]
    next[index] = clamp(Math.round(mm * 10) / 10, 0, lengthMm)
    onMarkersChange(next)
  }

  const mmFromPointer = (e: PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    return (vertical ? e.clientY - rect.top : e.clientX - rect.left) / pxPerMm
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-ruler-ignore]')) return
    const mm = mmFromPointer(e)
    const handle = target.closest<HTMLElement>('[data-marker]')
    const index = handle ? (Number(handle.dataset.marker) as 0 | 1) : Math.abs(mm - shown[0]) <= Math.abs(mm - shown[1]) ? 0 : 1
    dragging.current = index
    move(index, mm)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== null) move(dragging.current, mmFromPointer(e))
  }
  const endDrag = () => {
    dragging.current = null
  }

  const onKeyDown = (index: 0 | 1) => (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1
    const keys: Record<string, number> = {
      ArrowUp: -step,
      ArrowLeft: -step,
      ArrowDown: step,
      ArrowRight: step,
      PageUp: -10,
      PageDown: 10,
    }
    let next: number | undefined
    if (e.key in keys) next = shown[index] + keys[e.key]
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = lengthMm
    if (next === undefined) return
    e.preventDefault()
    move(index, next)
  }

  const lo = Math.min(shown[0], shown[1]) * pxPerMm
  const hi = Math.max(shown[0], shown[1]) * pxPerMm

  return (
    <div
      ref={ref}
      data-testid="ruler"
      className={cn('relative select-none overflow-hidden bg-card text-foreground', vertical ? 'touch-none' : 'touch-pan-y', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Band between the markers */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bg-primary/35"
        style={vertical ? { top: lo, height: hi - lo, left: 0, right: 0 } : { left: lo, width: hi - lo, top: 0, bottom: 0 }}
      />
      {length > 0 && (
        <svg width={width} height={height} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
          <Scale ticks={metric} unit="cm" vertical={vertical} cross={cross} tickMax={tickMax} side="start" />
          <Scale ticks={imperial} unit="in" vertical={vertical} cross={cross} tickMax={tickMax} side="end" />
        </svg>
      )}
      {shown.map((mm, i) => {
        const pos = mm * pxPerMm
        const index = i as 0 | 1
        return (
          <div
            key={i}
            className="pointer-events-none absolute"
            style={vertical ? { top: pos, left: 0, right: 0, height: 0 } : { left: pos, top: 0, bottom: 0, width: 0 }}
          >
            <div aria-hidden="true" className={cn('absolute bg-foreground', vertical ? 'inset-x-0 -top-px h-0.5' : 'inset-y-0 -left-px w-0.5')} />
            <div
              role="slider"
              data-marker={i}
              tabIndex={0}
              aria-label={`Marker ${LETTERS[i]}`}
              aria-orientation={orientation}
              aria-valuemin={0}
              aria-valuemax={Math.floor(lengthMm)}
              aria-valuenow={Math.round(mm * 10) / 10}
              aria-valuetext={`${formatMetric(mm)} (${formatInchFraction(mm / MM_PER_INCH)})`}
              onKeyDown={onKeyDown(index)}
              className={cn(
                'pointer-events-auto absolute grid size-11 cursor-grab place-items-center rounded-full bg-foreground text-sm font-bold text-background shadow-md active:cursor-grabbing',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              )}
              style={{
                ...(vertical ? { left: `${i === 0 ? 38 : 62}%`, top: 0 } : { top: `${i === 0 ? 40 : 60}%`, left: 0 }),
                // Keep the whole handle on screen when its marker sits at either end of the ruler.
                transform: vertical ? `translate(-50%, ${handleShift(pos, length)})` : `translate(${handleShift(pos, length)}, -50%)`,
              }}
            >
              {LETTERS[i]}
            </div>
          </div>
        )
      })}
      {readout && (
        <div aria-live="polite" data-ruler-ignore className="absolute top-1/2 left-1/2 w-max max-w-[90%] -translate-x-1/2 -translate-y-1/2">
          <TapeReadout
            size="md"
            value={formatMetric(distanceMm)}
            secondary={`${formatInchFraction(distanceMm / MM_PER_INCH)} · ${(distanceMm / MM_PER_INCH).toFixed(2)} in`}
            className="min-w-44 text-center [&_p]:text-center"
          />
        </div>
      )}
    </div>
  )
}

function Scale({ ticks, unit, vertical, cross, tickMax, side }: { ticks: Tick[]; unit: string; vertical: boolean; cross: number; tickMax: number; side: 'start' | 'end' }) {
  // `start` draws from the top/left edge, `end` from the bottom/right edge.
  const edge = side === 'start' ? 0 : cross
  const dir = side === 'start' ? 1 : -1
  return (
    <g className="text-foreground" stroke="currentColor" strokeWidth={1} fill="currentColor">
      {ticks.map((t) => {
        const len = t.size * tickMax
        return vertical ? (
          <line key={t.pos} x1={edge} x2={edge + dir * len} y1={t.pos} y2={t.pos} />
        ) : (
          <line key={t.pos} y1={edge} y2={edge + dir * len} x1={t.pos} x2={t.pos} />
        )
      })}
      {ticks
        .filter((t) => t.label !== undefined)
        .map((t, i) => {
          const text = i === 0 ? unit : t.label
          const off = edge + dir * (tickMax + 4)
          return vertical ? (
            <text key={`l${t.pos}`} x={off} y={i === 0 ? t.pos + 12 : t.pos} dominantBaseline="middle" textAnchor={side === 'start' ? 'start' : 'end'} fontSize={12} fontWeight={600} stroke="none" className="tabular-nums">
              {text}
            </text>
          ) : (
            <text key={`l${t.pos}`} x={i === 0 ? t.pos + 3 : t.pos} y={off} dominantBaseline={side === 'start' ? 'hanging' : 'auto'} textAnchor={i === 0 ? 'start' : 'middle'} fontSize={12} fontWeight={600} stroke="none" className="tabular-nums">
              {text}
            </text>
          )
        })}
    </g>
  )
}
