import { Download } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { downloadText } from '../../lib/download'
import { CopyButton } from './CopyButton'
import { Field, controlBase } from './Field'

export interface OutputFieldProps {
  label?: ReactNode
  value: string
  /** Render as a multi-line textarea. */
  multiline?: boolean
  rows?: number
  mono?: boolean
  placeholder?: string
  hint?: ReactNode
  error?: ReactNode
  /** When set, shows a download button saving `value` under this filename. */
  downloadName?: string
  downloadMime?: string
  copyable?: boolean
  className?: string
  /** Extra controls next to the copy button. */
  actions?: ReactNode
}

/** Read-only result field with copy (and optional download) actions. */
export function OutputField({
  label,
  value,
  multiline,
  rows = 6,
  mono = false,
  placeholder,
  hint,
  error,
  downloadName,
  downloadMime,
  copyable = true,
  className,
  actions,
}: OutputFieldProps) {
  const id = useId()
  const aside = (
    <>
      {actions}
      {downloadName && (
        <button
          type="button"
          aria-label={`Download ${downloadName}`}
          title={`Download ${downloadName}`}
          disabled={!value}
          onClick={() => downloadText(value, downloadName, downloadMime)}
          className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <Download className="size-4" aria-hidden="true" />
        </button>
      )}
      {copyable && <CopyButton value={value} label={typeof label === 'string' ? `Copy ${label.toLowerCase()}` : 'Copy'} />}
    </>
  )
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} labelAside={aside} className={className}>
      {multiline ? (
        <textarea
          id={id}
          readOnly
          rows={rows}
          value={value}
          placeholder={placeholder}
          className={cn(controlBase, 'block resize-y bg-subtle px-3 py-2.5 leading-relaxed scrollbar-thin', mono ? 'font-mono text-sm' : 'tabular-nums')}
          spellCheck={false}
        />
      ) : (
        <input
          id={id}
          readOnly
          value={value}
          placeholder={placeholder}
          className={cn(controlBase, 'h-11 bg-subtle px-3', mono ? 'font-mono text-[15px]' : 'tabular-nums')}
          spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </Field>
  )
}

export interface CodeBlockProps {
  code: string
  label?: ReactNode
  /** Max height before scrolling (CSS value). */
  maxHeight?: string
  className?: string
  copyable?: boolean
  downloadName?: string
  wrap?: boolean
}

/** Pre-formatted, scrollable code/text output with copy button. */
export function CodeBlock({ code, label, maxHeight = '28rem', className, copyable = true, downloadName, wrap }: CodeBlockProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {(label || copyable || downloadName) && (
        <div className="flex min-h-9 items-center justify-between gap-2">
          {label ? <span className="text-sm font-semibold">{label}</span> : <span />}
          <div className="flex items-center">
            {downloadName && (
              <button
                type="button"
                aria-label={`Download ${downloadName}`}
                title={`Download ${downloadName}`}
                disabled={!code}
                onClick={() => downloadText(code, downloadName)}
                className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <Download className="size-4" aria-hidden="true" />
              </button>
            )}
            {copyable && <CopyButton value={code} />}
          </div>
        </div>
      )}
      <pre
        tabIndex={0}
        style={{ maxHeight }}
        className={cn(
          'overflow-auto rounded-xl bg-subtle p-3 font-mono text-sm leading-relaxed scrollbar-thin',
          wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
        )}
      >
        <code>{code || ' '}</code>
      </pre>
    </div>
  )
}

export interface KeyValueItem {
  label: ReactNode
  value: ReactNode
  /** Plain-text value to copy. Defaults to `value` when it is a string/number. */
  copyValue?: string
  /** Monospace, for real code only. Values use tabular figures by default. */
  mono?: boolean
}

/** Two-column list of labelled values (e.g. parsed results), each optionally copyable. */
export function KeyValueList({ items, className, copyable = true }: { items: KeyValueItem[]; className?: string; copyable?: boolean }) {
  return (
    <dl className={cn('divide-y divide-border overflow-hidden rounded-xl bg-subtle', className)}>
      {items.map((item, i) => {
        const copyText = item.copyValue ?? (typeof item.value === 'string' || typeof item.value === 'number' ? String(item.value) : '')
        return (
          <div key={i} className="grid grid-cols-1 gap-x-4 gap-y-0.5 px-3 py-2 sm:grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)] sm:items-center">
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="flex min-w-0 items-center justify-between gap-2">
              <span className={cn('min-w-0 break-words text-base font-semibold tabular-nums', item.mono && 'font-mono font-medium')}>
                {item.value === '' || item.value == null ? '—' : item.value}
              </span>
              {copyable && copyText ? <CopyButton value={copyText} label={`Copy ${typeof item.label === 'string' ? item.label : 'value'}`} /> : null}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
