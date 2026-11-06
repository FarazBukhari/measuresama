import { createStore } from './createStore'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  action?: ToastAction
}

export interface ToastOptions {
  duration?: number
  /** A button shown in the toast, e.g. "Share" after saving a file. */
  action?: ToastAction
}

export const toastStore = createStore<ToastItem[]>([])
let nextId = 1

/** Show a short, non-blocking notification. Toasts with an action stay up longer. */
export function toast(message: string, tone: ToastTone = 'info', options: number | ToastOptions = {}): void {
  const opts: ToastOptions = typeof options === 'number' ? { duration: options } : options
  const duration = opts.duration ?? (opts.action ? 6000 : 2200)
  const id = nextId++
  toastStore.set((list) => [...list.slice(-2), { id, message, tone, action: opts.action }])
  setTimeout(() => dismissToast(id), duration)
}

export function dismissToast(id: number): void {
  toastStore.set((list) => list.filter((t) => t.id !== id))
}
