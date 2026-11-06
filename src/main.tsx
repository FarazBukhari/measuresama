import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/plus-jakarta-sans'
import './styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { hydrateStorage } from './lib/storage'
import { isNativeApp } from './state/install'
import { toast } from './state/toast'

// The stores read saved settings and history when their modules load, so the saved data must
// be restored from the native store first: App and the state modules are imported after it.
async function start(): Promise<void> {
  await hydrateStorage()
  const [{ default: App }, { applyTheme }] = await Promise.all([import('./App'), import('./state/preferences')])
  applyTheme()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

void start()

// Offline support: register the service worker (web only — the native app bundles everything).
if (import.meta.env.PROD && !isNativeApp() && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onOfflineReady() {
        toast('Ready to work offline', 'success')
      },
    })
  })
}
