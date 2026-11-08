import { cn } from '../../lib/cn'

// The brand colours are fixed (tape yellow, ink) so the mark looks the same on light and dark grounds.
const TAPE_YELLOW = '#FFC629'
const INK = '#141414'

/** Brand mark: a square of tape blade with ink ticks hanging from its top edge. */
export function LogoMark({ className }: { className?: string }) {
  const ticks = [
    { x: 10.5, h: 17 },
    { x: 15.25, h: 10 },
    { x: 20, h: 17 },
    { x: 24.75, h: 10 },
    { x: 29.5, h: 17 },
  ]
  return (
    <svg viewBox="0 0 40 40" className={cn('size-8 shrink-0', className)} aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="10" fill={TAPE_YELLOW} />
      {ticks.map(({ x, h }) => (
        <path key={x} d={`M${x - 1.25} 0h2.5v${h - 1.25}a1.25 1.25 0 0 1-2.5 0Z`} fill={INK} />
      ))}
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-foreground">Measure Sama</span>
    </span>
  )
}
