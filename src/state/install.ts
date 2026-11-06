import { Capacitor } from '@capacitor/core'
import { createStore } from './createStore'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const installPromptStore = createStore<BeforeInstallPromptEvent | null>(null)

export const isNativeApp = (): boolean => Capacitor.isNativePlatform()

export function isStandalone(): boolean {
  return (
    isNativeApp() ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPromptStore.set(e as BeforeInstallPromptEvent)
  })
  window.addEventListener('appinstalled', () => installPromptStore.set(null))
}

export async function promptInstall(): Promise<boolean> {
  const evt = installPromptStore.get()
  if (!evt) return false
  await evt.prompt()
  const choice = await evt.userChoice
  installPromptStore.set(null)
  return choice.outcome === 'accepted'
}
