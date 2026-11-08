import { Camera, Download, RefreshCw, Ruler } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArGestureArt, InstallArt, NoCameraArt, ScanStepArt, TapEndArt, TapStartArt } from '../components/ModeArt'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { PageHeader } from '../components/layout/PageHeader'
import { Alert, Button, Card, Stack } from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { LengthUnit } from '../lib/units'
import { ArMeasure, arErrorCode, checkArAvailability, isArMeasurement, requestArInstall, type ArAvailability, type ArCancelled } from '../plugins/ar-measure'
import { addFromArResult } from '../state/history'
import { setUnit, showTipsStore, unitStore } from '../state/settings'
import { toast } from '../state/toast'

const UNIT_CHOICES: { value: LengthUnit; label: string }[] = [
  { value: 'cm', label: 'cm' },
  { value: 'in', label: 'in' },
]

const STEPS = [
  { Art: ScanStepArt, text: 'Scan the floor' },
  { Art: TapStartArt, text: 'Tap one end' },
  { Art: TapEndArt, text: 'Tap the other end' },
]

export const PERMISSION_MESSAGE = 'Allow the camera in your phone’s Settings to measure.'

interface Notice {
  tone: 'error' | 'warning' | 'info'
  text: string
}

function cancelledNotice(r: ArCancelled): Notice | null {
  switch (r.reason) {
    case 'permission-denied':
      return { tone: 'warning', text: PERMISSION_MESSAGE }
    case 'ar-unavailable':
      return { tone: 'warning', text: r.message || 'The camera isn’t ready. Try again.' }
    case 'tracking-lost':
      return { tone: 'warning', text: r.message || 'Lost its place. Try again in good light.' }
    default:
      return null // The user closed the camera screen: nothing to say.
  }
}

function errorNotice(e: unknown): Notice {
  switch (arErrorCode(e)) {
    case 'NOT_IMPLEMENTED':
      return { tone: 'info', text: 'This mode is coming soon.' }
    case 'BUSY':
      return { tone: 'info', text: 'The camera is already open.' }
    case 'UNAVAILABLE':
      return { tone: 'error', text: 'This phone can’t measure with the camera.' }
    default:
      return { tone: 'error', text: 'Something went wrong. Try again.' }
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
    <div className="flex flex-col">
      <PageHeader back="/" title="Measure a distance" />

      {!availability ? (
        <p role="status" className="flex items-center gap-3 text-muted-foreground">
          <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
          Checking your phone…
        </p>
      ) : status === 'supported' ? (
        <Stack>
          <Card>
            <div className="flex justify-center">
              <ArGestureArt className="w-full max-w-60" />
            </div>
          </Card>
          {showTips && (
            <ol aria-label="How to measure" className="grid grid-cols-3 gap-2">
              {STEPS.map(({ Art, text }) => (
                <li key={text} className="flex flex-col items-center gap-2 text-center text-sm font-semibold">
                  <Art className="size-12" />
                  {text}
                </li>
              ))}
            </ol>
          )}
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
          <Button size="lg" icon={Camera} fullWidth loading={busy} onClick={() => void start()}>
            Start measuring
          </Button>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-muted-foreground">Units</span>
            <ChoiceGroup legend="Units" size="sm" value={unit} onChange={setUnit} choices={UNIT_CHOICES} className="w-40 [&>legend]:sr-only" />
          </div>
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
  const heading =
    status === 'needs-install'
      ? 'One free app needed'
      : status === 'needs-update'
        ? 'Update one free app'
        : status === 'unknown'
          ? 'Couldn’t check this phone'
          : 'This phone can’t measure with the camera'
  const line = needsApp ? 'Google Play Services for AR' : status === 'unknown' ? reason || 'Check your internet and try again.' : undefined

  return (
    <section data-testid="ar-fallback" data-status={status} aria-labelledby="ar-fallback-heading" className="flex flex-col items-center gap-4 rounded-[20px] bg-card p-5 text-center text-card-foreground">
      {needsApp ? <InstallArt className="w-32" /> : <NoCameraArt className="w-32" />}
      <h2 id="ar-fallback-heading" className="text-xl font-bold tracking-tight">
        {heading}
      </h2>
      {line && <p className="text-sm text-muted-foreground">{line}</p>}
      <div className="flex w-full flex-col gap-2">
        {needsApp && (
          <Button icon={Download} fullWidth loading={busy} onClick={onInstall}>
            Install it
          </Button>
        )}
        {status === 'unknown' && (
          <Button variant="tonal" icon={RefreshCw} fullWidth onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button variant={needsApp || status === 'unknown' ? 'tonal' : 'primary'} icon={Ruler} fullWidth onClick={onRuler}>
          Use the on-screen ruler
        </Button>
      </div>
    </section>
  )
}
