import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/plus-jakarta-sans'
import './styles/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import { applyTheme } from './state/preferences'
import { isNativeApp } from './state/install'
import { toast } from './state/toast'

applyTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

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
