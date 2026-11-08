import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface TapeReadoutProps {
  /** The main figure, e.g. "1.24 m". */
  value: ReactNode
  /** Second line: the same length in the other unit. */
  secondary?: ReactNode
  /** Top-right chip, e.g. <Badge tone="tape-warning">Estimate</Badge>. */
  status?: ReactNode
  /** Top-right buttons, e.g. a copy button. */
  actions?: ReactNode
  size?: 'md' | 'lg'
  /** Announce changes to the figure (aria-live="polite"). */
  live?: boolean
  valueTestId?: string
  secondaryTestId?: string
  className?: string
}

/** Tick marks every 6px: long every 10, medium every 5, short between. */
const STEP = 6
const TICKS = Array.from({ length: 10 }, (_, i) => {
  const h = i === 0 ? 13 : i === 5 ? 9 : 5
  return `M${i * STEP + 0.75} 0v${h}`
}).join('')

/** The signature readout: the measured figure on a yellow tape blade with ticks along its top edge. */
export function TapeReadout({ value, secondary, status, actions, size = 'lg', live, valueTestId, secondaryTestId, className }: TapeReadoutProps) {
  const patternId = `tape-ticks-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <div className={cn('relative overflow-hidden rounded-[20px] bg-primary text-primary-foreground', className)}>
      <svg aria-hidden="true" focusable="false" className="block h-4 w-full" width="100%" height="16">
        <defs>
          <pattern id={patternId} x="14" y="0" width={STEP * 10} height="16" patternUnits="userSpaceOnUse">
            <path d={TICKS} stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="16" fill={`url(#${patternId})`} />
      </svg>
      <div className={cn('flex items-start gap-3', size === 'lg' ? 'px-5 pt-2 pb-5' : 'px-4 pt-1 pb-4')}>
        <div className="min-w-0 flex-1">
          <p
            data-testid={valueTestId}
            aria-live={live ? 'polite' : undefined}
            className={cn('break-words font-extrabold leading-none tracking-[-0.03em] tabular-nums', size === 'lg' ? 'text-[52px]' : 'text-[32px]')}
          >
            {value}
          </p>
          {secondary != null && secondary !== '' && (
            <p data-testid={secondaryTestId} className="mt-2 break-words text-base font-semibold text-tape-ink-2 tabular-nums">
              {secondary}
            </p>
          )}
        </div>
        {(status || actions) && (
          <div className="flex shrink-0 items-center gap-1 [&_button]:text-primary-foreground [&_button:hover]:bg-primary-hover [&_button:focus-visible]:outline-primary-foreground">
            {status}
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
