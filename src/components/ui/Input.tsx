import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { parseNumber } from '../../lib/format'
import { Field, controlBase } from './Field'

interface CommonFieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  labelAside?: ReactNode
  /** Use the monospace font (for code, hashes, ids). */
  mono?: boolean
  containerClassName?: string
}

export interface TextInputProps extends CommonFieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'prefix' | 'value'> {
  value: string
  onChange?: (value: string) => void
  prefix?: ReactNode
  suffix?: ReactNode
}

/** Single-line text input with label, hint and inline error. `onChange` receives the string value. */
export function TextInput({ label, hint, error, labelAside, mono, containerClassName, className, onChange, prefix, suffix, id, ...props }: TextInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <Field label={label} htmlFor={inputId} hint={hint} error={error} labelAside={labelAside} className={containerClassName} hintId={`${inputId}-hint`} errorId={`${inputId}-error`}>
      <Adorned prefix={prefix} suffix={suffix}>
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(controlBase, 'h-11 px-3', mono && 'font-mono text-[15px]', prefix != null && 'pl-9', suffix != null && 'pr-14', className)}
          onChange={(e) => onChange?.(e.target.value)}
          spellCheck={mono ? false : undefined}
          autoComplete={props.autoComplete ?? 'off'}
          {...props}
        />
      </Adorned>
    </Field>
  )
}

function Adorned({ prefix, suffix, children }: { prefix?: ReactNode; suffix?: ReactNode; children: ReactNode }) {
  if (prefix == null && suffix == null) return <>{children}</>
  return (
    <div className="relative">
      {prefix != null && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">{prefix}</span>
      )}
      {children}
      {suffix != null && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>
      )}
    </div>
  )
}

export interface NumberInputProps extends CommonFieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'prefix' | 'value' | 'type'> {
  /** Current numeric value. NaN means "empty". */
  value: number
  /** Receives the parsed number (NaN when the field is empty or invalid). */
  onChange?: (value: number) => void
  prefix?: ReactNode
  suffix?: ReactNode
  /** Allow negative numbers (default true). */
  allowNegative?: boolean
  /** Allow decimals (default true). */
  allowDecimal?: boolean
}

/** Numeric input that shows the numeric keypad on phones and tolerates "1,234.5" style input. */
export function NumberInput({ value, onChange, allowNegative = true, allowDecimal = true, ...props }: NumberInputProps) {
  const [text, setText] = useState(() => (Number.isFinite(value) ? String(value) : ''))
  const lastEmitted = useRef(value)

  useEffect(() => {
    // Sync when the value is changed from outside (e.g. reset / swap buttons).
    if (Object.is(value, lastEmitted.current)) return
    lastEmitted.current = value
    setText(Number.isFinite(value) ? String(value) : '')
  }, [value])

  const pattern = allowDecimal ? (allowNegative ? /^-?[\d,_ ]*\.?\d*$/ : /^[\d,_ ]*\.?\d*$/) : allowNegative ? /^-?[\d,_ ]*$/ : /^[\d,_ ]*$/

  return (
    <TextInput
      {...props}
      value={text}
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      onChange={(next) => {
        if (next !== '' && !pattern.test(next) && !/^-?\d*\.?\d*e[+-]?\d*$/i.test(next)) return
        setText(next)
        const n = parseNumber(next)
        lastEmitted.current = n
        onChange?.(n)
      }}
    />
  )
}

export interface TextAreaProps extends CommonFieldProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string
  onChange?: (value: string) => void
}

/** Multi-line text input. `onChange` receives the string value. */
export function TextArea({ label, hint, error, labelAside, mono, containerClassName, className, onChange, id, rows = 6, ...props }: TextAreaProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <Field label={label} htmlFor={inputId} hint={hint} error={error} labelAside={labelAside} className={containerClassName} hintId={`${inputId}-hint`} errorId={`${inputId}-error`}>
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(controlBase, 'block resize-y px-3 py-2.5 leading-relaxed scrollbar-thin', mono && 'font-mono text-sm', className)}
        onChange={(e) => onChange?.(e.target.value)}
        spellCheck={mono ? false : undefined}
        {...props}
      />
    </Field>
  )
}
