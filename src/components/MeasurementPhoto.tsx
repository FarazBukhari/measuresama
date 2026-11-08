import { Capacitor } from '@capacitor/core'
import { Image as ImageIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'

/** Local photo URL for the WebView. Browsers can't open file:// URIs, so there is none on the web. */
function photoSrc(uri: string | undefined): string | undefined {
  if (!uri || !Capacitor.isNativePlatform()) return undefined
  return Capacitor.convertFileSrc(uri)
}

/** The photo saved with a measurement, or a plain placeholder when there is none. */
export function MeasurementPhoto({ uri, alt, className, placeholder }: { uri?: string; alt: string; className?: string; placeholder?: ReactNode }) {
  const src = photoSrc(uri)
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)} aria-hidden="true">
        {placeholder ?? <ImageIcon className="size-6" />}
      </span>
    )
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cn('object-cover', className)} />
}
