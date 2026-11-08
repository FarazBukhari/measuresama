import { CreditCard, Maximize2, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CardArt } from '../../components/ModeArt'
import { Alert, Badge, Button, CopyButton, Disclosure, Grid, IconButton, InfoButton, KeyValueList, NumberInput, Row, SegmentedControl, Select, Stack, TapeReadout } from '../../components/ui'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { usePersistentState } from '../../hooks/usePersistentState'
import { readAndroidMetrics } from '../../native/screenMetrics'
import { unitStore } from '../../state/settings'
import { calibrationsStore, forgetCalibration, saveCalibration } from './calibration'
import { CardCheck } from './CardCheck'
import { enterFullscreen, exitFullscreen } from './fullscreen'
import { FullscreenOverlay } from './FullscreenOverlay'
import { Ruler, type Markers } from './Ruler'
import {
  approxResolution,
  calibrationWarnings,
  diagonalInFromPxPerMm,
  estimateCalibration,
  formatInchFraction,
  formatMetric,
  fromAndroidMetrics,
  fromAppleDisplay,
  inchesFrom,
  isAppleMobile,
  isCardChecked,
  isEstimate,
  matchAppleDisplays,
  MM_PER_INCH,
  ppiFromPxPerMm,
  pxPerMmFromDiagonal,
  readScreen,
  screenKey,
  SOURCE_LABEL,
  type AndroidMetrics,
  type Calibration,
} from './screen-ruler'

export default function ScreenRuler() {
  const [screen, setScreen] = useState(readScreen)
  useEffect(() => {
    const update = () => setScreen(readScreen())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const [android, setAndroid] = useState<AndroidMetrics | null>(null)
  useEffect(() => {
    let live = true
    void readAndroidMetrics().then((m) => live && setAndroid(m))
    return () => {
      live = false
    }
  }, [])

  const unit = unitStore.use()
  const coarse = useMediaQuery('(pointer: coarse)') || /Android|Mobi/i.test(navigator.userAgent)
  const portrait = useMediaQuery('(orientation: portrait)')
  const apple = useMemo(() => (isAppleMobile(navigator.userAgent, navigator.maxTouchPoints) ? matchAppleDisplays(screen) : []), [screen])
  const [appleIndex, setAppleIndex] = useState(0)

  const detected: Calibration = useMemo(() => {
    const fromAndroid = android ? fromAndroidMetrics(android, screen.dpr) : null
    if (fromAndroid) return fromAndroid
    if (apple.length) return fromAppleDisplay(apple[Math.min(appleIndex, apple.length - 1)])
    return estimateCalibration(coarse)
  }, [android, apple, appleIndex, coarse, screen.dpr])

  const key = screenKey(screen)
  const saved = calibrationsStore.use()
  const savedHere = saved[key]
  const calibration = savedHere ?? detected
  const cardChecked = isCardChecked(savedHere)
  const estimate = isEstimate(calibration)
  const warnings = calibrationWarnings(calibration, detected)
  const save = (c: Calibration) => saveCalibration(key, c)

  const [markers, setMarkers] = usePersistentState<Markers>('screen-ruler:markers', [0, 30])
  const [fullMarkers, setFullMarkers] = usePersistentState<Markers>('screen-ruler:full-markers', [0, 100])
  const [full, setFull] = useState(false)
  const [cardCheck, setCardCheck] = useState(false)

  const openFull = () => {
    enterFullscreen()
    setFull(true)
  }
  const closeFull = useCallback(() => {
    exitFullscreen()
    setFull(false)
  }, [])
  const openCardCheck = () => {
    enterFullscreen()
    setCardCheck(true)
  }
  const closeCardCheck = useCallback(() => {
    exitFullscreen()
    setCardCheck(false)
  }, [])

  const pxPerMm = calibration.pxPerMm
  const diagonal = calibration.specDiagonalIn ?? diagonalInFromPxPerMm(screen, pxPerMm)
  const ppi = calibration.ppi ?? ppiFromPxPerMm(pxPerMm, screen.dpr)
  const resolution = calibration.resolution ?? approxResolution(screen)
  const exactResolution = !!calibration.resolution
  const distanceMm = Math.abs(markers[1] - markers[0])
  const inches = distanceMm / MM_PER_INCH

  const mainValue = unit === 'in' ? formatInchFraction(inches) : formatMetric(distanceMm)
  const otherValue = unit === 'in' ? formatMetric(distanceMm) : formatInchFraction(inches)
  const copyValue = unit === 'in' ? inches.toFixed(2) : (distanceMm / 10).toFixed(2)

  return (
    <Stack>
      {!cardChecked && (
        <div data-testid="card-prompt" className="flex flex-col gap-3 rounded-[20px] bg-card p-4 text-card-foreground">
          <div className="flex items-center gap-3">
            <CardArt className="size-12 shrink-0" />
            <InfoButton
              className="min-w-0 flex-1"
              label="Why check?"
              info="Phones don’t always report their screen size. One check makes the ruler accurate to about 1 mm."
            >
              <h2 className="text-base font-bold">Check the size with a bank card</h2>
            </InfoButton>
          </div>
          <Button icon={CreditCard} onClick={openCardCheck} fullWidth>
            Start card check
          </Button>
        </div>
      )}

      {warnings.map((w) => (
        <Alert key={w} tone="warning">
          {w}
        </Alert>
      ))}

      <TapeReadout
        live
        value={mainValue}
        secondary={`${otherValue} · ${distanceMm.toFixed(1)} mm`}
        status={calibration.confirmed ? <Badge tone="tape-success">Checked</Badge> : <Badge tone="tape-warning">Estimate</Badge>}
        actions={<CopyButton value={copyValue} label="Copy length" />}
      />

      <Ruler pxPerMm={pxPerMm} orientation="horizontal" markers={markers} onMarkersChange={setMarkers} className="h-36 rounded-[20px]" />

      <Button variant="secondary" icon={Maximize2} onClick={openFull} fullWidth>
        Full-screen ruler
      </Button>

      <Disclosure label="Screen details">
        <Stack>
          <KeyValueList
            copyable={false}
            items={[
              {
                label: 'Scale from',
                mono: false,
                value: (
                  <span data-testid="scale-source" data-source={calibration.source}>
                    {calibration.device && calibration.source !== 'card' && calibration.source !== 'screen-size'
                      ? `${SOURCE_LABEL[calibration.source]} — ${calibration.device}`
                      : SOURCE_LABEL[calibration.source]}
                  </span>
                ),
              },
              { label: 'Screen resolution', value: `${exactResolution ? '' : 'about '}${resolution[0]} × ${resolution[1]} pixels` },
              { label: 'Pixel density', value: <span>{`${Math.round(ppi)} pixels per inch (ppi)`}</span> },
              { label: 'Screen size', value: Number.isFinite(diagonal) ? `${diagonal.toFixed(1)} in · ${(diagonal * 2.54).toFixed(1)} cm` : '—' },
            ]}
          />

          {apple.length > 1 && !savedHere && (
            <Select
              label="Which model is this?"
              value={String(appleIndex)}
              onChange={(v) => setAppleIndex(Number(v))}
              options={apple.map((d, i) => ({ value: String(i), label: `${d.name} (${d.diagonal}″)` }))}
            />
          )}

          <p className="text-sm text-muted-foreground">
            {cardChecked
              ? 'Checked with a card. Accurate to about 1 mm.'
              : calibration.confirmed
                ? 'For the best accuracy, also check with a card.'
                : 'Until you check with a card, this is a best guess.'}
          </p>

          {(cardChecked || savedHere) && (
            <Row>
              {cardChecked && (
                <Button variant="tonal" icon={CreditCard} onClick={openCardCheck}>
                  Check again with a card
                </Button>
              )}
              {savedHere && (
                <Button variant="ghost" icon={RotateCcw} onClick={() => forgetCalibration(key)}>
                  Start over
                </Button>
              )}
            </Row>
          )}

          <h3 className="pt-2 text-base font-bold">No card? Use the screen size</h3>
          <ScreenSizeCheck
            key={key}
            initialInches={Number.isFinite(diagonal) ? Math.round(diagonal * 10) / 10 : 6.1}
            onSave={(inchesIn) => save({ pxPerMm: pxPerMmFromDiagonal(screen, inchesIn), source: 'screen-size', confirmed: true, specDiagonalIn: inchesIn })}
            preview={(inchesIn) => pxPerMmFromDiagonal(screen, inchesIn)}
            dpr={screen.dpr}
          />
        </Stack>
      </Disclosure>

      <FullscreenOverlay open={full} onClose={closeFull} label="Full-screen ruler">
        <div className="relative h-full w-full">
          <Ruler pxPerMm={pxPerMm} orientation={portrait ? 'vertical' : 'horizontal'} markers={fullMarkers} onMarkersChange={setFullMarkers} readout className="absolute inset-0" />
          <div data-ruler-ignore className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 safe-bottom">
            {estimate && <Badge tone="tape-warning">Estimate</Badge>}
            <IconButton icon={X} label="Close ruler" variant="secondary" onClick={closeFull} className="bg-card shadow-lg" />
          </div>
        </div>
      </FullscreenOverlay>

      <FullscreenOverlay open={cardCheck} onClose={closeCardCheck} label="Card check">
        <CardCheck
          pxPerMm={pxPerMm}
          onCancel={closeCardCheck}
          onSave={(scale) => {
            save({ pxPerMm: scale, source: 'card', confirmed: true })
            closeCardCheck()
          }}
        />
      </FullscreenOverlay>
    </Stack>
  )
}

function ScreenSizeCheck({
  initialInches,
  onSave,
  preview,
  dpr,
}: {
  initialInches: number
  onSave: (inches: number) => void
  preview: (inches: number) => number
  dpr: number
}) {
  const [value, setValue] = useState(initialInches)
  const [unit, setUnit] = useState<'in' | 'cm'>('in')
  const inches = inchesFrom(value, unit)
  const ok = Number.isFinite(inches) && inches >= 2 && inches <= 120
  const scale = ok ? preview(inches) : NaN
  return (
    <Stack>
      <Grid cols={2}>
        <NumberInput
          label="Screen size (diagonal)"
          value={value}
          onChange={setValue}
          allowNegative={false}
          suffix={unit === 'in' ? 'inches' : 'cm'}
          error={Number.isFinite(value) && !ok ? 'Enter the screen’s diagonal size, e.g. 6.1 inches.' : undefined}
          hint="Corner to corner, from the box or spec sheet."
        />
        <SegmentedControl
          label="Screen size unit"
          value={unit}
          onChange={(u) => {
            if (Number.isFinite(value)) setValue(Math.round((u === 'cm' ? value * 2.54 : value / 2.54) * 10) / 10)
            setUnit(u)
          }}
          options={[
            { value: 'in', label: 'Inches' },
            { value: 'cm', label: 'cm' },
          ]}
        />
      </Grid>
      <p className="text-sm text-muted-foreground">{ok ? `That’s ${Math.round(ppiFromPxPerMm(scale, dpr))} pixels per inch.` : 'Enter a size to see the pixel density.'}</p>
      <Button variant="tonal" disabled={!ok} onClick={() => onSave(inches)}>
        Use this screen size
      </Button>
    </Stack>
  )
}
