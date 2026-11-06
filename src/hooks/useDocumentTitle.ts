import { useEffect } from 'react'

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} – Measure Sama` : 'Measure Sama – A free tape measure for your phone'
  }, [title])
}
