import { Capacitor } from '@capacitor/core'
import { Share2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, TextArea } from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatDateTime } from '../lib/format'
import type { LengthUnit } from '../lib/units'
import { MODES } from '../modes/catalog'
import { ResultDetail } from '../modes/results/ResultDetail'
import { shareText } from '../modes/results/summary'
import { historyStore, removeHistoryItem, setHistoryNote, type HistoryItem } from '../state/history'
import { unitStore } from '../state/settings'
import { toast } from '../state/toast'

const isCancel = (e: unknown) => /cancel|abort/i.test(e instanceof Error ? `${e.name} ${e.message}` : String(e))

/**
 * Share the result (and the photo in the app). Only text and the photo file are shared:
 * the app's own address (https://localhost) means nothing to anyone else.
 */
async function shareMeasurement(item: HistoryItem, unit: LengthUnit): Promise<void> {
  const text = shareText(item, unit)
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title: 'Measurement', text, files: item.screenshotUri ? [item.screenshotUri] : undefined, dialogTitle: 'Share measurement' })
    } catch (e) {
      if (!isCancel(e)) toast('Could not open sharing on this phone', 'error')
    }
    return
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return
    } catch (e) {
      if (isCancel(e)) return
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    toast('Copied to clipboard', 'success')
  } catch {
    toast('Could not share or copy the measurement', 'error')
  }
}

export default function HistoryDetailPage() {
  const { id = '' } = useParams()
  const items = historyStore.use()
  const item = items.find((i) => i.id === id)
  useDocumentTitle(item ? 'Measurement' : 'Measurement not found')

  if (!item) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">We can’t find that measurement</h1>
        <Link to="/history" className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover">
          Back to history
        </Link>
      </div>
    )
  }
  return <Detail key={item.id} item={item} />
}

function Detail({ item }: { item: HistoryItem }) {
  const navigate = useNavigate()
  const unit = unitStore.use()
  const [note, setNote] = useState(item.note ?? '')
  const [confirming, setConfirming] = useState(false)

  const remove = async () => {
    navigate('/history', { replace: true })
    await removeHistoryItem(item.id)
    toast('Measurement deleted', 'success')
  }

  return (
    <div className="flex flex-col">
      <PageHeader back="/history" title="Measurement" />

      <div className="flex flex-col gap-4">
        <ResultDetail item={item} unit={unit} />
        <p className="text-sm text-muted-foreground">
          {MODES.find((m) => m.id === item.mode)?.name ?? 'Measurement'} · {formatDateTime(item.createdAt)}
        </p>

        <TextArea
          label="Note"
          placeholder="What did you measure?"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(v) => {
            setNote(v)
            setHistoryNote(item.id, v)
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <Button icon={Share2} onClick={() => void shareMeasurement(item, unit)}>
            Share
          </Button>
          <Button variant="tonal" icon={Trash2} onClick={() => setConfirming(true)} disabled={confirming}>
            Delete
          </Button>
        </div>

        {confirming && (
          <div role="alertdialog" aria-labelledby="delete-title" className="flex flex-col gap-3 rounded-[20px] bg-destructive-soft p-4 text-destructive-soft-foreground">
            <p id="delete-title" className="font-semibold">
              Delete this measurement?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={() => void remove()}>
                Yes, delete
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
