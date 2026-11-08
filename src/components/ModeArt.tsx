import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

/*
 * Drawn pictograms: 2px ink strokes (currentColor), round caps and joins, one yellow tape element.
 * The tape colour can be changed with the CSS variable --art-tape (e.g. on a yellow tile).
 * All decorative (aria-hidden): the name is always shown next to them.
 */

const TAPE = 'var(--art-tape, var(--color-primary))'

type ArtProps = { className?: string }

function Art({ className, viewBox = '0 0 48 48', children }: ArtProps & { viewBox?: string; children: ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('size-12 shrink-0', className)}
    >
      {children}
    </svg>
  )
}

/** Tick marks hanging from y, every `step` from x0; every other one longer. */
function ticks(x0: number, y: number, count: number, step: number, long = 4, short = 2.5): string {
  return Array.from({ length: count }, (_, i) => `M${x0 + i * step} ${y}v${i % 2 === 0 ? long : short}`).join('')
}

function DistanceArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <path d="M7 11v26M41 11v26" />
      <rect x="10" y="19" width="28" height="10" rx="2" fill={TAPE} />
      <path d={ticks(14, 19, 5, 5)} />
    </Art>
  )
}

function ScreenRulerArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <rect x="13" y="5" width="22" height="38" rx="4" />
      <path d="M21 9.5h6" />
      <rect x="16.5" y="18" width="15" height="9" rx="1.5" fill={TAPE} />
      <path d={ticks(19.5, 18, 4, 3, 3.5, 2)} />
      <path d="M22 38.5h4" />
    </Art>
  )
}

function HeightArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <path d="M7 42h34" />
      <rect x="20" y="7" width="9" height="35" rx="1.5" fill={TAPE} />
      <path d="M20 12h4M20 17h2.5M20 22h4M20 27h2.5M20 32h4M20 37h2.5" />
      <path d="M14 7h21" />
      <path d="M36 14v22M33 17l3-3 3 3M33 33l3 3 3-3" />
    </Art>
  )
}

function AngleArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <path d="M25 40A17 17 0 0 0 19.6 27.5" stroke={TAPE} strokeWidth={6} strokeLinecap="butt" />
      <path d="M8 40h34M8 40L33 13" />
      <circle cx="8" cy="40" r="1.5" fill="currentColor" />
    </Art>
  )
}

function PathArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <path d="M8 38L18 18L30 30L40 10" stroke={TAPE} strokeWidth={6} />
      <path d="M8 38L18 18L30 30L40 10" />
      <circle cx="8" cy="38" r="3" fill="currentColor" />
      <circle cx="18" cy="18" r="3" fill="currentColor" />
      <circle cx="30" cy="30" r="3" fill="currentColor" />
      <circle cx="40" cy="10" r="3" fill="currentColor" />
    </Art>
  )
}

function AreaArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <path d="M6 35L15 13H42L33 35Z" fill={TAPE} />
      <circle cx="6" cy="35" r="2" fill="currentColor" />
      <circle cx="15" cy="13" r="2" fill="currentColor" />
      <circle cx="42" cy="13" r="2" fill="currentColor" />
      <circle cx="33" cy="35" r="2" fill="currentColor" />
    </Art>
  )
}

function VolumeArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <path d="M8 16L24 24V42L8 34Z" fill={TAPE} />
      <path d="M8 16L24 8L40 16L24 24Z" />
      <path d="M24 24L40 16V34L24 42" />
    </Art>
  )
}

function RoomPlanArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <rect x="6" y="5" width="36" height="7" rx="1.5" fill={TAPE} />
      <path d={ticks(10, 5, 7, 5, 3, 2)} />
      <path d="M6 12v30h36V12" />
      <path d="M6 27h12M28 27h14" />
      <path d="M18 27v-9" />
      <path d="M18 18a9 9 0 0 1 9 9" strokeDasharray="2 3" />
    </Art>
  )
}

function PhotoArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <rect x="5" y="8" width="38" height="32" rx="4" />
      <path d="M5 34l10-10 8 8 6-6 14 14" />
      <rect x="10" y="13" width="20" height="7" rx="1.5" fill={TAPE} />
      <path d={ticks(13, 13, 5, 3.5, 3, 2)} />
      <circle cx="36" cy="17" r="3" />
    </Art>
  )
}

const MODE_ART: Record<string, (props: ArtProps) => ReactNode> = {
  distance: DistanceArt,
  'screen-ruler': ScreenRulerArt,
  height: HeightArt,
  angle: AngleArt,
  path: PathArt,
  area: AreaArt,
  volume: VolumeArt,
  'room-plan': RoomPlanArt,
  photo: PhotoArt,
}

/** The pictogram for a mode id; unknown ids show the lucide `fallback` icon. */
export function ModeArt({ id, fallback: Fallback, className }: { id: string; fallback?: LucideIcon; className?: string }) {
  const Drawn = MODE_ART[id]
  if (Drawn) return <Drawn className={className} />
  if (Fallback) return <Fallback className={cn('size-12 shrink-0', className)} strokeWidth={2} aria-hidden="true" />
  return null
}

/** A bank card, with the tape measuring its long edge. */
export function CardArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <rect x="5" y="7" width="38" height="25" rx="3" />
      <rect x="10" y="13" width="7" height="6" rx="1" />
      <path d="M10 26h12" />
      <rect x="5" y="36" width="38" height="7" rx="1.5" fill={TAPE} />
      <path d={ticks(9, 36, 8, 4.5, 3, 2)} />
    </Art>
  )
}

/** Step 1: move the phone over the floor. */
export function ScanStepArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <path d="M6 43L12 33H42L36 43Z" fill={TAPE} />
      <rect x="18" y="4" width="12" height="21" rx="3" />
      <path d="M22.5 7.5h3" />
      <path d="M12 10c-3 3-3 8 0 11M36 10c3 3 3 8 0 11" />
    </Art>
  )
}

/** Step 2: tap where the length starts. */
export function TapStartArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <path d="M5 42L11 30H43L37 42Z" />
      <circle cx="22" cy="36" r="4" fill={TAPE} />
      <path d="M22 6v17M17 18l5 5 5-5" />
    </Art>
  )
}

/** Step 3: tap where the length ends. */
export function TapEndArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      <path d="M5 42L11 30H43L37 42Z" />
      <rect x="13" y="33" width="22" height="6" rx="1.5" fill={TAPE} />
      <circle cx="13" cy="36" r="2" fill="currentColor" />
      <circle cx="35" cy="36" r="2" fill="currentColor" />
      <path d="M35 6v17M30 18l5 5 5-5" />
    </Art>
  )
}

/** The gesture: a phone pointed at the floor, two points, the tape between them. */
export function ArGestureArt({ className }: ArtProps) {
  return (
    <Art className={cn('h-auto w-full max-w-60', className)} viewBox="0 0 240 150">
      <path d="M14 140L56 92H226L184 140Z" />
      <path d="M70 124L176 104L178 112L72 132Z" fill={TAPE} />
      <path d="M86 121.5l1 4M100 118.8l.6 2.6M114 116.2l1 4M128 113.5l.6 2.6M142 110.9l1 4M156 108.2l.6 2.6" />
      <circle cx="71" cy="128" r="5" fill="currentColor" />
      <circle cx="177" cy="108" r="5" fill="currentColor" />
      <rect x="98" y="8" width="44" height="74" rx="8" />
      <path d="M113 15h14" />
      <circle cx="120" cy="45" r="9" />
      <path d="M120 40v10M115 45h10" />
      <path d="M120 82v14" strokeDasharray="3 5" />
    </Art>
  )
}

/** Empty history: a rolled-up tape measure. */
export function EmptyHistoryArt({ className }: ArtProps) {
  return (
    <Art className={cn('size-24', className)}>
      <rect x="3" y="12" width="28" height="28" rx="9" />
      <circle cx="17" cy="26" r="5" />
      <rect x="29" y="31" width="14" height="9" rx="1" fill={TAPE} />
      <path d={ticks(33, 31, 3, 3.5, 3.5, 2)} />
      <path d="M44 28.5v13" />
    </Art>
  )
}

/** Not found: a strip of tape with a torn end. */
export function NotFoundArt({ className }: ArtProps) {
  return (
    <Art className={cn('size-24', className)}>
      <path d="M3 18h28l-3 3.5 3.5 3.5-3 3.5 2.5 3.5H3Z" fill={TAPE} />
      <path d={ticks(7, 18, 6, 4, 4, 2.5)} />
      <path d="M45 18h-6l-3 3.5 3.5 3.5-3 3.5 2.5 3.5h6" fill={TAPE} />
    </Art>
  )
}

/** Install: a phone with a down arrow and a strip of tape. */
export function InstallArt({ className }: ArtProps) {
  return (
    <Art className={cn('size-24', className)}>
      <rect x="13" y="3" width="22" height="42" rx="4" />
      <path d="M24 10v15M18.5 19.5l5.5 5.5 5.5-5.5" />
      <rect x="16.5" y="31" width="15" height="7" rx="1.5" fill={TAPE} />
      <path d={ticks(19.5, 31, 4, 3, 3, 2)} />
    </Art>
  )
}

/** No camera: a camera with a slash, a strip of tape under it. */
export function NoCameraArt({ className }: ArtProps) {
  return (
    <Art className={cn('size-24', className)}>
      <path d="M6 14h8l3-4h14l3 4h8v18H6Z" />
      <circle cx="24" cy="23" r="5" />
      <path d="M8 6l32 30" />
      <rect x="6" y="38" width="36" height="6" rx="1.5" fill={TAPE} />
      <path d={ticks(10, 38, 7, 4.7, 3, 2)} />
    </Art>
  )
}
