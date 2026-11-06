import { CreditCard, Maximize2, RotateCcw, Smartphone, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Grid, IconButton, KeyValueList, NumberInput, Row, SegmentedControl, Select, Stack, Stat, StatGrid } from '../../components/ui'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { usePersistentState } from '../../hooks/usePersistentState'
import { readAndroidMetrics, readDeviceModel } from '../../native/screenMetrics'
import { showTipsStore, unitStore } from '../../state/settings'
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
  const [model, setModel] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void readAndroidMetrics().then((m) => live && setAndroid(m))
    void readDeviceModel().then((m) => live && setModel(m))
    return () => {
      live = false
    }
  }, [])

  const unit = unitStore.use()
  const showTips = showTipsStore.use()
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
  const deviceHint = calibration.device ?? model ?? undefined
  const inches = distanceMm / MM_PER_INCH

  return (
    <Stack>
      {!cardChecked && (
        <Card
          data-testid="card-prompt"
          title="Check the size with a bank card"
          description="Phones don’t always report their screen size correctly. Hold any bank card, ID card or driving licence against the screen once, and the ruler will be accurate to about a millimetre."
        >
          <Row>
            <Button icon={CreditCard} onClick={openCardCheck}>
              Start card check
            </Button>
          </Row>
        </Card>
      )}

      <Card
        title="Ruler"
        description={
          showTips ? 'Lay the object on the screen. Drag markers A and B to its ends, or tap the ruler to move the nearest marker.' : undefined
        }
        actions={
          <Button size="sm" icon={Maximize2} onClick={openFull}>
            Full-screen ruler
          </Button>
        }
      >
        <Stack>
          <Ruler pxPerMm={pxPerMm} orientation="horizontal" markers={markers} onMarkersChange={setMarkers} className="h-32 rounded-md border border-border" />
          <StatGrid cols={3}>
            {unit === 'in' ? (
              <Stat emphasis label="Distance A → B" value={formatInchFraction(inches)} hint={estimate ? 'Estimate until checked with a card' : `${inches.toFixed(2)} in`} copyValue={inches.toFixed(2)} />
            ) : (
              <Stat emphasis label="Distance A → B" value={formatMetric(distanceMm)} hint={estimate ? 'Estimate until checked with a card' : undefined} copyValue={(distanceMm / 10).toFixed(2)} />
            )}
            {unit === 'in' ? (
              <Stat label="In centimetres" value={formatMetric(distanceMm)} />
            ) : (
              <Stat label="In inches" value={formatInchFraction(inches)} hint={`${inches.toFixed(2)} in`} />
            )}
            <Stat label="In millimetres" value={`${distanceMm.toFixed(1)} mm`} />
          </StatGrid>
        </Stack>
      </Card>

      <Card
        title="Screen scale"
        description="How big this screen’s pixels really are. Saved on this device only."
        actions={calibration.confirmed ? <Badge tone="success">Checked</Badge> : <Badge tone="warning">Estimate</Badge>}
      >
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
              { label: 'Pixel density', value: `${Math.round(ppi)} pixels per inch (ppi)` },
              { label: 'Screen size (diagonal)', value: Number.isFinite(diagonal) ? `${diagonal.toFixed(1)} in · ${(diagonal * 2.54).toFixed(1)} cm` : '—' },
            ]}
          />

          {apple.length > 1 && !savedHere && (
            <Select
              label="Which model is this?"
              hint="Several models share this screen layout but not the same pixel size."
              value={String(appleIndex)}
              onChange={(v) => setAppleIndex(Number(v))}
              options={apple.map((d, i) => ({ value: String(i), label: `${d.name} (${d.diagonal}″)` }))}
            />
          )}

          {warnings.map((w) => (
            <Alert key={w} tone="warning" title="Please check the size again">
              {w}
            </Alert>
          ))}

          {cardChecked ? (
            <Alert tone="success" title="Checked with a card">
              The ruler matches your screen. Measurements are accurate to about a millimetre.
            </Alert>
          ) : calibration.confirmed ? (
            <Alert tone="success" title="Screen size checked">
              For the most accurate ruler, also check it with a bank card.
            </Alert>
          ) : (
            <Alert tone="warning" title="This ruler is an estimate">
              {calibration.source === 'estimate'
                ? 'Browsers don’t say how big a screen’s pixels are, so the ruler guesses until you check it with a card.'
                : 'The size your phone reports is often slightly off. Check it once with a card to be sure.'}
            </Alert>
          )}

          <Row>
            {cardChecked && (
              <Button variant="outline" icon={CreditCard} onClick={openCardCheck}>
                Check again with a card
              </Button>
            )}
            {savedHere && (
              <Button variant="ghost" icon={RotateCcw} onClick={() => forgetCalibration(key)}>
                Start over
              </Button>
            )}
          </Row>
        </Stack>
      </Card>

      <Card title="No card nearby?" description="Enter your screen size from the box or spec sheet instead. A card check is more accurate.">
        <ScreenSizeCheck
          key={key}
          initialInches={Number.isFinite(diagonal) ? Math.round(diagonal * 10) / 10 : 6.1}
          deviceHint={deviceHint}
          onSave={(inchesIn) => save({ pxPerMm: pxPerMmFromDiagonal(screen, inchesIn), source: 'screen-size', confirmed: true, specDiagonalIn: inchesIn })}
          preview={(inchesIn) => pxPerMmFromDiagonal(screen, inchesIn)}
          dpr={screen.dpr}
        />
      </Card>

      <FullscreenOverlay open={full} onClose={closeFull} label="Full-screen ruler">
        <div className="relative h-full w-full">
          <Ruler pxPerMm={pxPerMm} orientation={portrait ? 'vertical' : 'horizontal'} markers={fullMarkers} onMarkersChange={setFullMarkers} readout className="absolute inset-0" />
          <div data-ruler-ignore className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 safe-bottom">
            {estimate && <p className="w-max rounded-md bg-warning-soft px-2 py-1 text-xs text-warning-soft-foreground">Estimate: not checked with a card</p>}
            <IconButton icon={X} label="Close ruler" variant="outline" onClick={closeFull} className="rounded-full shadow-md" />
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
  deviceHint,
  onSave,
  preview,
  dpr,
}: {
  initialInches: number
  deviceHint?: string
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
          hint={deviceHint ? `Search “${deviceHint} screen size” if you’re not sure.` : 'It’s on the box or the spec sheet, measured corner to corner.'}
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
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {ok ? `That makes ${Math.round(ppiFromPxPerMm(scale, dpr))} pixels per inch on this screen.` : 'Enter a size to see the pixel density.'} Keep the browser zoom at 100%.
      </p>
      <Row>
        <Button disabled={!ok} onClick={() => onSave(inches)}>
          Use this screen size
        </Button>
      </Row>
    </Stack>
  )
}
