import { useId } from 'react'
import { cn } from '../../lib/cn'
import type { LengthUnit } from '../../lib/units'
import type { HistoryItem } from '../../state/history'
import { layoutRoomPlan } from './layout'

const WIDTH = 1000
const PAD = 150
const FONT = 44

/** The room seen from above, with each wall's number and length. Nothing when there are fewer than 3 corners. */
export function RoomPlanView({ item, unit, className }: { item: Pick<HistoryItem, 'points' | 'segmentsM'>; unit: LengthUnit; className?: string }) {
  const titleId = useId()
  // Height follows the room's shape, within limits, so long rooms don't leave a tall empty box.
  const draft = layoutRoomPlan(item, unit, { width: WIDTH, height: WIDTH, pad: PAD, fontSize: FONT })
  if (!draft) return null
  const ys = draft.corners.map((c) => c.y)
  const used = Math.max(...ys) - Math.min(...ys)
  const height = Math.min(WIDTH, Math.max(used + 2 * PAD, 2 * PAD + 200))
  const plan = layoutRoomPlan(item, unit, { width: WIDTH, height, pad: PAD, fontSize: FONT })
  if (!plan) return null

  return (
    <svg
      viewBox={`0 0 ${plan.width} ${plan.height}`}
      role="img"
      aria-labelledby={titleId}
      data-testid="room-plan"
      className={cn('h-auto w-full text-foreground', className)}
    >
      <title id={titleId}>Room plan</title>
      <polygon
        points={plan.corners.map((c) => `${c.x},${c.y}`).join(' ')}
        className="fill-primary-soft stroke-primary"
        strokeWidth={8}
        strokeLinejoin="round"
      />
      {plan.corners.map((c, i) => (
        <circle key={`c${i}`} cx={c.x} cy={c.y} r={9} className="fill-primary" />
      ))}
      {plan.walls.map((w) => (
        <g key={w.number}>
          <circle cx={w.badge.x} cy={w.badge.y} r={FONT * 0.6} className="fill-card stroke-primary" strokeWidth={3} />
          <text x={w.badge.x} y={w.badge.y} textAnchor="middle" dominantBaseline="central" fontSize={FONT * 0.7} fontWeight={700} className="fill-primary">
            {w.number}
          </text>
          <text x={w.label.x} y={w.label.y} textAnchor="middle" dominantBaseline="central" fontSize={FONT} fontWeight={600} className="fill-current font-mono">
            {w.text}
          </text>
        </g>
      ))}
    </svg>
  )
}
