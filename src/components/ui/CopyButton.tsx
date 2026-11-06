import { Check, Copy } from 'lucide-react'
import { useCopy } from '../../hooks/useCopy'
import { cn } from '../../lib/cn'
import { Button, type ButtonProps } from './Button'

export interface CopyButtonProps {
  value: string
  /** Visible label. When omitted an icon-only button is rendered. */
  children?: string
  /** Accessible name. Required to tell apart several icon-only copy buttons; optional with visible text. */
  label?: string
  size?: 'sm' | 'md'
  variant?: ButtonProps['variant']
  className?: string
  disabled?: boolean
}

/** Copies `value` to the clipboard and shows a check mark + toast. */
export function CopyButton({ value, children, label, size = 'sm', variant, className, disabled }: CopyButtonProps) {
  const { copy, copied } = useCopy()
  if (children) {
    return (
      <Button
        size={size}
        variant={variant ?? 'secondary'}
        icon={copied ? Check : Copy}
        onClick={() => copy(value)}
        disabled={disabled || value === ''}
        className={className}
        aria-label={label}
      >
        {copied ? 'Copied' : children}
      </Button>
    )
  }
  return (
    <button
      type="button"
      aria-label={label ?? 'Copy to clipboard'}
      title={label ?? 'Copy to clipboard'}
      onClick={() => copy(value)}
      disabled={disabled || value === ''}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'size-9' : 'size-11',
        copied && 'text-success',
        className,
      )}
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
    </button>
  )
}
