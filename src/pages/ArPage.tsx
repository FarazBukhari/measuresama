import { Camera, Download, RefreshCw, Ruler } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, Card, Stack } from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { UNIT_LABEL } from '../lib/units'
import { ArMeasure, arErrorCode, checkArAvailability, isArMeasurement, requestArInstall, type ArAvailability, type ArCancelled } from '../plugins/ar-measure'
import { addFromArResult } from '../state/history'
import { showTipsStore, unitStore } from '../state/settings'
import { toast } from '../state/toast'

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

export default function ArPage() {
  useDocumentTitle('Measure a distance')
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
    setNotice(null)
    setBusy(true)
    try {
      const r = await ArMeasure.start({ mode: 'distance', unit })
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Measure a distance</h1>
        <p className="text-muted-foreground">Use your phone’s camera to measure between two spots.</p>
      </div>

      {!availability ? (
        <p role="status" className="flex items-center gap-3 text-muted-foreground">
          <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          Checking your phone…
        </p>
      ) : status === 'supported' ? (
        <Stack>
          {showTips && (
            <Card title="How to measure">
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px]">
                <li>Point your phone at the floor and move it slowly.</li>
                <li>Tap to place the first point at one end of the thing you’re measuring.</li>
                <li>Move to the other end and tap again. The length shows straight away.</li>
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
        <ArFallback availability={availability} busy={busy} onInstall={() => void install()} onRetry={recheck} onRuler={() => navigate('/ruler')} />
      )}
    </div>
  )
}

function ArFallback({
  availability,
  busy,
  onInstall,
  onRetry,
  onRuler,
}: {
  availability: ArAvailability
  busy: boolean
  onInstall: () => void
  onRetry: () => void
  onRuler: () => void
}) {
  const { status, reason } = availability
  const needsApp = status === 'needs-install' || status === 'needs-update'
  const heading = needsApp ? 'Measuring with the camera needs a free Google app (Google Play Services for AR)' : 'AR isn’t available on this phone'
  const explanation = needsApp
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
      <p className="text-muted-foreground">{explanation}</p>
      {!needsApp && <p className="text-muted-foreground">The on-screen ruler works on every phone and is great for small things.</p>}
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
      </div>
    </section>
  )
}
