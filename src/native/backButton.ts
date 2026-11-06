import { Capacitor, type PluginListenerHandle } from '@capacitor/core'

export interface BackContext {
  /** Close the top-most overlay (search, menu); return true if one was closed. */
  closeOverlay: () => boolean
  pathname: () => string
  goBack: () => void
  goHome: () => void
}

export type BackAction = 'close-overlay' | 'back' | 'home' | 'exit'

/** What Android's back button should do (pure, so it can be unit-tested). */
export function decideBackAction(overlayOpen: boolean, pathname: string, canGoBack: boolean): BackAction {
  if (overlayOpen) return 'close-overlay'
  if (pathname !== '/') return canGoBack ? 'back' : 'home'
  return 'exit'
}

/**
 * Android's hardware back button. Without a handler Capacitor closes the app from any page.
 * Returns a cleanup function.
 */
export function registerBackButton(ctx: BackContext): () => void {
  if (Capacitor.getPlatform() !== 'android') return () => undefined
  let handle: PluginListenerHandle | undefined
  let disposed = false
  void import('@capacitor/app').then(async ({ App }) => {
    if (disposed) return
    handle = await App.addListener('backButton', ({ canGoBack }) => {
      const action = decideBackAction(false, ctx.pathname(), canGoBack)
      if (ctx.closeOverlay()) return
      if (action === 'back') ctx.goBack()
      else if (action === 'home') ctx.goHome()
      else void App.exitApp()
    })
  })
  return () => {
    disposed = true
    void handle?.remove()
  }
}
