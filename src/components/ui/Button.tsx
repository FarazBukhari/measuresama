import type { LucideIcon } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  // On the page ground. Inside a card, use `tonal`.
  secondary: 'bg-card text-card-foreground hover:bg-muted',
  tonal: 'bg-muted text-foreground hover:bg-border',
  outline: 'bg-transparent text-foreground inset-ring inset-ring-input hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  danger: 'bg-destructive text-destructive-foreground hover:opacity-90',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm gap-1.5',
  md: 'h-11 px-5 text-base gap-2',
  lg: 'h-14 px-7 text-lg gap-2.5',
}

const iconSize: Record<ButtonSize, string> = { sm: 'size-4', md: 'size-[18px]', lg: 'size-5' }

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading, fullWidth, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-full font-semibold transition-[background-color,color,opacity,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      ) : (
        Icon && <Icon className={iconSize[size]} aria-hidden="true" />
      )}
      {children}
      {IconRight && <IconRight className={iconSize[size]} aria-hidden="true" />}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name — required because the button has no visible text. */
  label: string
  icon: LucideIcon
  variant?: 'ghost' | 'outline' | 'secondary' | 'tonal' | 'primary'
  size?: 'sm' | 'md'
  pressed?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon: Icon, variant = 'ghost', size = 'md', pressed, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'size-9' : 'size-11',
        variants[variant],
        className,
      )}
      {...props}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-5'} aria-hidden="true" />
    </button>
  )
})
