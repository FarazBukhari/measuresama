import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '../state/toast'

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

/** Copy helper with a transient `copied` flag and a toast. */
export function useCopy(timeout = 1500) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(
    async (text: string, message = 'Copied to clipboard') => {
      const ok = await copyToClipboard(text)
      if (ok) {
        setCopied(true)
        toast(message, 'success')
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), timeout)
      } else {
        toast('Could not copy — select the text and copy manually', 'error')
      }
      return ok
    },
    [timeout],
  )

  return { copy, copied }
}
