import { Upload } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface FileDropProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  label?: ReactNode
  hint?: ReactNode
  className?: string
}

/** Click-or-drop file picker. Fully keyboard accessible (it is a real button). */
export function FileDrop({ onFiles, accept, multiple, label = 'Choose a file or drop it here', hint, className }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const [dragging, setDragging] = useState(false)
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const files = Array.from(e.dataTransfer.files)
          if (files.length) onFiles(multiple ? files : files.slice(0, 1))
        }}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed px-4 py-8 text-center transition-colors duration-150',
          dragging ? 'border-foreground bg-primary-soft' : 'border-input bg-subtle hover:border-foreground hover:bg-muted',
        )}
      >
        <Upload className="size-6 text-foreground" aria-hidden="true" />
        <span className="text-sm font-semibold">{label}</span>
        {hint && (
          <span id={`${id}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="file-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
