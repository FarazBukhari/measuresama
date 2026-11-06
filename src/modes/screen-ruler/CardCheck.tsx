import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton, Slider } from '../../components/ui'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { CARD_HEIGHT_MM, CARD_WIDTH_MM } from './screen-ruler'

/**
 * Full-screen card match: the user lays a bank/ID card on the screen and resizes the outline
 * until its width matches. Only the width is matched (pixels are square), so the outline may run
 * off the bottom of a small phone — that's fine.
 */
export function CardCheck({ pxPerMm, onSave, onCancel }: { pxPerMm: number; onSave: (pxPerMm: number) => void; onCancel: () => void }) {
  const portrait = useMediaQuery('(orientation: portrait)')
  const [scale, setScale] = useState(pxPerMm)
  // In portrait the card stands upright, so its short side runs across the screen.
  const acrossMm = portrait ? CARD_HEIGHT_MM : CARD_WIDTH_MM
  const alongMm = portrait ? CARD_WIDTH_MM : CARD_HEIGHT_MM
  const widthPx = scale * acrossMm
  const min = Math.round(pxPerMm * acrossMm * 0.6)
  const max = Math.round(pxPerMm * acrossMm * 1.6)
  const setWidth = (px: number) => setScale(Math.min(max, Math.max(min, px)) / acrossMm)

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden safe-top">
        <div
          data-testid="card-outline"
          className="absolute top-4 left-4 border-2 border-dashed border-primary bg-primary/5"
          style={{ width: widthPx, height: scale * alongMm, borderRadius: scale * 3.18 }}
        >
          <p className="max-w-[16rem] p-3 text-sm text-muted-foreground">
            Line up a card’s top-left corner with this corner, then resize until the card’s right edge meets the outside of the dashed line.
          </p>
        </div>
      </div>
      <div className="border-t border-border bg-card px-4 pt-3 pb-4 safe-bottom">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Any bank card, ID card or driving licence works — they are all 85.60 × 53.98 mm. Hold it flat against the glass.
          </p>
          <div className="flex items-end gap-2">
            <IconButton variant="outline" icon={Minus} label="Make outline smaller" onClick={() => setWidth(widthPx - 0.5)} />
            <Slider
              className="min-w-0 flex-1"
              label="Outline width"
              value={Math.round(widthPx * 2) / 2}
              onChange={setWidth}
              min={min}
              max={max}
              step={0.5}
              format={(v) => `${v.toFixed(1)} px`}
            />
            <IconButton variant="outline" icon={Plus} label="Make outline larger" onClick={() => setWidth(widthPx + 0.5)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onCancel} fullWidth>
              Cancel
            </Button>
            <Button onClick={() => onSave(scale)} fullWidth>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
