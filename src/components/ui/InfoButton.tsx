import { Info } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from './Button'

export interface InfoButtonProps {
  /** The short explanation (one or two lines) shown below the row. */
  info: ReactNode
  /** The row the button sits in (e.g. a heading). */
  children?: ReactNode
  /** Accessible name of the button. */
  label?: string
  className?: string
  panelClassName?: string
}

/** A row with a round "i" button that shows or hides a short explanation below it. */
export function InfoButton({ info, children, label = 'More info', className, panelClassName }: InfoButtonProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        <IconButton icon={Info} label={label} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)} className="-mr-2 text-muted-foreground" />
      </div>
      <div id={panelId} hidden={!open} className={cn('mt-1 text-sm text-muted-foreground', panelClassName)}>
        {info}
      </div>
    </div>
  )
}
