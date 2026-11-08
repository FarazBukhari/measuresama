import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { cn } from '../../lib/cn'
import { IconButton } from '../ui'
import { LogoMark } from './Logo'

export interface PageHeaderProps {
  title: ReactNode
  /** Show a Back button. Goes to the previous screen of this session, else to this path. */
  back?: string
  /** Icon buttons on the right. */
  actions?: ReactNode
  /** Logo mark before the title (Home). */
  brand?: boolean
  className?: string
}

/** The page's h1, with an optional Back chevron and trailing actions. */
export function PageHeader({ title, back, actions, brand, className }: PageHeaderProps) {
  const navigate = useNavigate()
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) void navigate(-1)
    else if (back !== undefined) void navigate(back)
  }
  return (
    <header className={cn('mb-6 flex min-h-11 items-center gap-2', className)}>
      {back !== undefined && <IconButton icon={ChevronLeft} label="Back" onClick={goBack} className="-ml-2.5 [&>svg]:size-6" />}
      <h1 className="flex min-w-0 items-center gap-3 break-words text-[28px] font-bold leading-tight tracking-tight">
        {brand && <LogoMark className="size-10" />}
        <span className="min-w-0">{title}</span>
      </h1>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  )
}
