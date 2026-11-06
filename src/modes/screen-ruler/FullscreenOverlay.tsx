import { useEffect, useRef, type ReactNode } from 'react'
import { overlayStore } from '../../state/ui'

/** A modal that covers the whole viewport. Esc and Android's back button close it. */
export function FullscreenOverlay({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close?.()
  }, [open])

  useEffect(() => {
    if (!open) return
    // Updater form: the store treats a bare function as an updater and would call it.
    overlayStore.set(() => onClose)
    return () => {
      if (overlayStore.get() === onClose) overlayStore.set(null)
    }
  }, [open, onClose])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden border-0 bg-background p-0 text-foreground backdrop:bg-background"
    >
      {open && children}
    </dialog>
  )
}
