import { Camera, Download, Image as ImageIcon, RefreshCw, Ruler } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Alert, Button, Card, Stack } from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { UNIT_LABEL } from '../lib/units'
import { AR_MODE_COPY, isArPageMode } from '../modes/ar/modeCopy'
import {
  ArMeasure,
  arErrorCode,
  canStartMode,
  checkArAvailability,
  isArMeasurement,
  requestArInstall,
  type ArAvailability,
  type ArCancelled,
  type ArPluginMode,
} from '../plugins/ar-measure'
import { addFromArResult } from '../state/history'
import { showTipsStore, unitStore } from '../state/settings'
import { toast } from '../state/toast'
import NotFoundPage from './NotFoundPage'

export const PERMISSION_MESSAGE = "Measure Sama needs the camera to measure. You can allow it in your phone's Settings."

interface Notice {
  tone: 'error' | 'warning' | 'info'
  text: string
}

function cancelledNotice(r: ArCancelled): Notice | null {
  switch (r.reason) {
    case 'permission-denied':
      return { tone: 'warning', text: PERMISSION_MESSAGE }
    case 'ar-unavailable':
      return { tone: 'warning', text: r.message || 'Measuring with the camera isn’t available right now. Please try again.' }
    case 'tracking-lost':
      return { tone: 'warning', text: r.message || 'The phone lost its place. Try again in good light and move your phone slowly.' }
    default:
      return null // The user closed the camera screen: nothing to say.
  }
}

function errorNotice(e: unknown): Notice {
  switch (arErrorCode(e)) {
    case 'NOT_IMPLEMENTED':
      return { tone: 'info', text: 'This measuring mode is coming soon.' }
    case 'BUSY':
      return { tone: 'info', text: 'The camera screen is already open.' }
    case 'UNAVAILABLE':
      return { tone: 'error', text: 'Measuring with the camera isn’t available on this phone.' }
    default:
      return { tone: 'error', text: 'Something went wrong. Please try again.' }
  }
}

/** /ar is distance; /ar/:mode is any other AR mode. Photo measure and unknown names have no AR page. */
export default function ArPage() {
  const { mode = 'distance' } = useParams()
  if (!isArPageMode(mode)) return <NotFoundPage />
  return <ArModePage key={mode} mode={mode} />
}

function ArModePage({ mode }: { mode: ArPluginMode }) {
  const copy = AR_MODE_COPY[mode]
  useDocumentTitle(copy.title)
  const navigate = useNavigate()
  const unit = unitStore.use()
  const showTips = showTipsStore.use()
  const [attempt, setAttempt] = useState(0)
  const [availability, setAvailability] = useState<ArAvailability | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Check once on open (and again after "Try again" / "Install it"). Never installs or starts by itself.
  useEffect(() => {
    let live = true
    void checkArAvailability().then((a) => {
      if (live) setAvailability(a)
    })
    return () => {
      live = false
    }
  }, [attempt])

  const start = async () => {
    // Only modes this build can measure: a rejected plugin call logs a console error.
    if (!canStartMode(availability, mode)) return
    setNotice(null)
    setBusy(true)
    try {
      const r = await ArMeasure.start({ mode, unit })
      if (isArMeasurement(r)) {
        const item = addFromArResult(r)
        toast('Saved', 'success')
        navigate(`/history/${item.id}`)
        return
      }
      if (mounted.current && r?.cancelled) setNotice(cancelledNotice(r))
    } catch (e) {
      if (mounted.current) setNotice(errorNotice(e))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const recheck = () => {
    setAvailability(null)
    setAttempt((n) => n + 1)
  }

  const install = async () => {
    setBusy(true)
    try {
      await requestArInstall()
    } finally {
      if (mounted.current) {
        setBusy(false)
        recheck()
      }
    }
  }

  const status = availability?.status
  const canStart = canStartMode(availability, mode)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground">{copy.intro}</p>
      </div>

      {!availability ? (
        <p role="status" className="flex items-center gap-3 text-muted-foreground">
          <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          Checking your phone…
        </p>
      ) : canStart ? (
        <Stack>
          {showTips && copy.tips.length > 0 && (
            <Card title="How to measure">
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px]">
                {copy.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ol>
            </Card>
          )}
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
          <Button size="lg" icon={Camera} fullWidth loading={busy} onClick={() => void start()} className="h-14 text-lg">
            Start measuring
          </Button>
          <p className="text-sm text-muted-foreground">Lengths show in {UNIT_LABEL[unit].toLowerCase()}. You can change this in Settings.</p>
        </Stack>
      ) : (
        <ArFallback
          availability={availability}
          modeUnavailable={status === 'supported'}
          busy={busy}
          onInstall={() => void install()}
          onRetry={recheck}
          onRuler={() => navigate('/ruler')}
          onPhoto={() => navigate('/photo')}
        />
      )}
    </div>
  )
}

/**
 * Shown when this mode can't start here: AR is missing or needs the Google app, or (modeUnavailable)
 * AR works but this build only measures other modes (iOS today). Always offers the ruler and photo measure.
 */
function ArFallback({
  availability,
  modeUnavailable,
  busy,
  onInstall,
  onRetry,
  onRuler,
  onPhoto,
}: {
  availability: ArAvailability
  modeUnavailable: boolean
  busy: boolean
  onInstall: () => void
  onRetry: () => void
  onRuler: () => void
  onPhoto: () => void
}) {
  const { reason } = availability
  const status = modeUnavailable ? 'mode-unavailable' : availability.status
  const needsApp = status === 'needs-install' || status === 'needs-update'
  const heading = modeUnavailable
    ? 'Coming soon on this phone'
    : needsApp
      ? 'Measuring with the camera needs a free Google app (Google Play Services for AR)'
      : 'AR isn’t available on this phone'
  const explanation = modeUnavailable
    ? null
    : needsApp
      ? status === 'needs-update'
        ? 'The copy on your phone needs an update. It’s free and takes a minute in the Play Store.'
        : 'It’s free and takes a minute to install from the Play Store.'
      : status === 'unknown'
        ? reason || 'We couldn’t check whether your phone can measure with the camera. Check your internet connection and try again.'
        : reason || 'This phone can’t measure with the camera.'

  return (
    <section data-testid="ar-fallback" data-status={status} aria-labelledby="ar-fallback-heading" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <h2 id="ar-fallback-heading" className="text-lg font-semibold">
        {heading}
      </h2>
      {explanation && <p className="text-muted-foreground">{explanation}</p>}
      {!needsApp && !modeUnavailable && <p className="text-muted-foreground">The on-screen ruler works on every phone and is great for small things.</p>}
      <div className="flex flex-wrap gap-2">
        {needsApp && (
          <Button icon={Download} loading={busy} onClick={onInstall}>
            Install it
          </Button>
        )}
        {status === 'unknown' && (
          <Button variant="outline" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button variant={needsApp || status === 'unknown' ? 'outline' : 'primary'} icon={Ruler} onClick={onRuler}>
          Use the on-screen ruler
        </Button>
        <Button variant="outline" icon={ImageIcon} onClick={onPhoto}>
          Use photo measure
        </Button>
      </div>
    </section>
  )
}
