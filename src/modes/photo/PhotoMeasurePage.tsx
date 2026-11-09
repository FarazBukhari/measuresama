import { Capacitor } from '@capacitor/core'
import { ArrowLeftRight, Camera, Eraser, Image as ImageIcon, ImagePlus, Plus, Save, TriangleAlert, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { ModeArt } from '../../components/ModeArt'
import { PageHeader } from '../../components/layout/PageHeader'
import { Alert, Button, Card, IconButton } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { saveAppPhoto } from '../../lib/download'
import type { Point2D } from '../../lib/geometry'
import { formatLength } from '../../lib/units'
import { addPhotoMeasurement, type PhotoLine } from '../../state/history'
import { unitStore } from '../../state/settings'
import { toast } from '../../state/toast'
import { CARD_LONG_MM, CARD_SHORT_MM, fitCard, measureMm } from './homography'
import { composeAnnotatedJpeg, decodePhoto, releaseCanvas, type DecodedPhoto } from './image'
import { PhotoCanvas, type DraftLine } from './PhotoCanvas'

/** A card-shaped quad in the middle of the photo, for the user to drag onto the real card. */
function startCorners(w: number, h: number): Point2D[] {
  const ratio = CARD_SHORT_MM / CARD_LONG_MM
  const landscape = w >= h
  let cw = w * 0.4
  let ch = landscape ? cw * ratio : cw / ratio
  if (ch > h * 0.6) {
    ch = h * 0.6
    cw = landscape ? ch / ratio : ch * ratio
  }
  const x = (w - cw) / 2
  const y = (h - ch) / 2
  return [
    { x, y },
    { x: x + cw, y },
    { x: x + cw, y: y + ch },
    { x, y: y + ch },
  ]
}

const r2 = (p: Point2D): Point2D => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 })
const r5 = (n: number) => Math.round(n * 1e5) / 1e5

export default function PhotoMeasurePage() {
  useDocumentTitle('Photo measure')
  const navigate = useNavigate()
  const unit = unitStore.use()
  const [photo, setPhoto] = useState<DecodedPhoto | null>(null)
  const [opening, setOpening] = useState(false)
  const [failed, setFailed] = useState(false)
  const [corners, setCorners] = useState<Point2D[]>([])
  const [swapped, setSwapped] = useState(false)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [cornersMoved, setCornersMoved] = useState(false)
  const [saving, setSaving] = useState(false)
  const takeRef = useRef<HTMLInputElement>(null)
  const chooseRef = useRef<HTMLInputElement>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  // Free the working image as soon as it is replaced or the page closes.
  useEffect(() => () => releaseCanvas(photo?.canvas), [photo])

  const open = async (file: File | undefined) => {
    if (!file) return
    setOpening(true)
    setFailed(false)
    try {
      const p = await decodePhoto(file)
      if (!alive.current) return releaseCanvas(p.canvas)
      setPhoto(p)
      setCorners(startCorners(p.width, p.height))
      setLines([])
      setSwapped(false)
      setCornersMoved(false)
    } catch {
      if (alive.current) setFailed(true)
    } finally {
      if (alive.current) setOpening(false)
    }
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    void open(file)
  }

  const fit = useMemo(() => (photo ? fitCard(corners, swapped) : null), [photo, corners, swapped])
  const lengthsM = lines.map((l) => (fit ? measureMm(fit.H, l.a, l.b) / 1000 : Number.NaN))
  const labels = lengthsM.map((m) => formatLength(m, unit))
  const savable = !!fit && lengthsM.some((m) => Number.isFinite(m) && m >= 0)

  const addLine = () => {
    if (!photo) return
    const n = lines.length
    const y = photo.height * (0.8 - (n % 5) * 0.04)
    setLines((ls) => [...ls, { a: { x: photo.width * 0.3, y }, b: { x: photo.width * 0.7, y } }])
  }

  const save = async () => {
    if (!photo || !fit || saving) return
    setSaving(true)
    const kept = lines.map((l, i) => ({ l, m: lengthsM[i], label: labels[i] })).filter((x) => Number.isFinite(x.m) && x.m >= 0)
    const photoLines: PhotoLine[] = kept.map(({ l, m }) => ({ a: r2(l.a), b: r2(l.b), lengthM: r5(m) }))
    let screenshotUri: string | undefined
    if (Capacitor.isNativePlatform()) {
      try {
        const blob = await composeAnnotatedJpeg(photo, fit.card, kept.map(({ l, label }) => ({ a: l.a, b: l.b, label })))
        if (blob) screenshotUri = await saveAppPhoto(blob)
      } catch {
        /* saved without the photo */
      }
    }
    try {
      const item = addPhotoMeasurement({
        unit,
        photo: { imageWidth: photo.width, imageHeight: photo.height, card: fit.card.map(r2), lines: photoLines },
        screenshotUri,
      })
      toast('Saved', 'success')
      navigate(`/history/${item.id}`)
    } catch {
      toast('Couldn’t save', 'error')
      if (alive.current) setSaving(false)
    }
  }

  const prompt = !fit
    ? null
    : lines.length > 0
      ? 'Drag the ends to adjust'
      : cornersMoved
        ? 'Now drag along the object'
        : 'Drag corners onto the card'

  return (
    <div className="flex flex-col">
      <PageHeader back="/" title="Photo measure" />

      <input ref={takeRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="photo-input-take" onChange={onFile} />
      <input ref={chooseRef} type="file" accept="image/*" className="hidden" data-testid="photo-input-choose" onChange={onFile} />

      {!photo ? (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex flex-col items-center gap-3 text-center">
              <ModeArt id="photo" className="size-32" />
              <p className="font-semibold">Card + object, flat on a table</p>
            </div>
          </Card>
          <div className="flex flex-col gap-2">
            <Button size="lg" icon={Camera} fullWidth loading={opening} onClick={() => takeRef.current?.click()}>
              Take photo
            </Button>
            <Button size="lg" variant="tonal" icon={ImageIcon} fullWidth disabled={opening} onClick={() => chooseRef.current?.click()}>
              Choose photo
            </Button>
          </div>
          {failed && <Alert tone="error">Can’t open this photo</Alert>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p aria-live="polite" className="flex min-h-6 items-center gap-2 font-medium">
            {prompt ?? (
              <>
                <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                Move the corners onto the card
              </>
            )}
          </p>

          <PhotoCanvas
            photo={photo}
            corners={corners}
            onCorners={setCorners}
            card={fit?.card ?? null}
            lines={lines}
            onLines={setLines}
            labels={labels}
            canDraw={!!fit}
            onCornerMoved={() => setCornersMoved(true)}
          />

          <div className="flex flex-wrap items-center gap-1">
            <IconButton label="Swap sides" icon={ArrowLeftRight} pressed={swapped} onClick={() => setSwapped((s) => !s)} />
            <IconButton label="Add line" icon={Plus} disabled={!fit} onClick={addLine} />
            <IconButton label="Undo" icon={Undo2} disabled={lines.length === 0} onClick={() => setLines((ls) => ls.slice(0, -1))} />
            <IconButton label="Clear lines" icon={Eraser} disabled={lines.length === 0} onClick={() => setLines([])} />
            <IconButton label="New photo" icon={ImagePlus} onClick={() => setPhoto(null)} />
          </div>

          <Button size="lg" icon={Save} fullWidth loading={saving} disabled={!savable} onClick={() => void save()}>
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
