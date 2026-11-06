import { SystemBars } from '@capacitor/core'
import { isNativeApp } from '../../state/install'

/**
 * Ask for the whole screen: in a phone browser this hides the address bar (a longer ruler);
 * in the app it hides the status and navigation bars. Call from a click handler.
 */
export function enterFullscreen(): void {
  if (isNativeApp()) {
    SystemBars.hide().catch(() => undefined)
    return
  }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  if (coarse && document.fullscreenEnabled && !document.fullscreenElement) {
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined)
  }
}

export function exitFullscreen(): void {
  if (isNativeApp()) {
    SystemBars.show().catch(() => undefined)
    return
  }
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined)
}
