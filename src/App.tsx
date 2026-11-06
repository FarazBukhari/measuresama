import { useEffect, useRef } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { registerBackButton } from './native/backButton'
import ArPage from './pages/ArPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import HistoryPage from './pages/HistoryPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import RulerPage from './pages/RulerPage'
import SettingsPage from './pages/SettingsPage'
import { overlayStore } from './state/ui'

/** Android's back button: close an open overlay, else go back, else home, else leave the app. */
function useAndroidBackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const path = useRef(location.pathname)
  useEffect(() => {
    path.current = location.pathname
  }, [location.pathname])
  useEffect(
    () =>
      registerBackButton({
        closeOverlay: () => {
          const close = overlayStore.get()
          if (close) {
            close()
            return true
          }
          return false
        },
        pathname: () => path.current,
        goBack: () => navigate(-1),
        goHome: () => navigate('/', { replace: true }),
      }),
    [navigate],
  )
}

export default function App() {
  useAndroidBackButton()
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ar" element={<ArPage />} />
        <Route path="/ruler" element={<RulerPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<HistoryDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  )
}
