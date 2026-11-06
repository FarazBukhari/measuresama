import { Ruler, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { Button, Card, Stack, Switch } from '../components/ui'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { UNIT_LABEL, type LengthUnit } from '../lib/units'
import { forgetThisScreen } from '../modes/screen-ruler/calibration'
import { clearHistory, historyStore } from '../state/history'
import { setShowTips, setTheme, setUnit, showTipsStore, themeStore, unitStore, type ThemePreference } from '../state/settings'
import { toast } from '../state/toast'

const UNIT_CHOICES: { value: LengthUnit; label: string }[] = [
  { value: 'cm', label: UNIT_LABEL.cm },
  { value: 'in', label: UNIT_LABEL.in },
]

const THEME_CHOICES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export default function SettingsPage() {
  useDocumentTitle('Settings')
  const navigate = useNavigate()
  const unit = unitStore.use()
  const theme = themeStore.use()
  const showTips = showTipsStore.use()
  const history = historyStore.use()
  const [confirmClear, setConfirmClear] = useState(false)

  const recalibrate = () => {
    forgetThisScreen()
    toast('Check the size with a bank card', 'info')
    navigate('/ruler')
  }

  const clear = async () => {
    await clearHistory()
    setConfirmClear(false)
    toast('History cleared', 'success')
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Card title="Units">
        <ChoiceGroup legend="Show lengths in" value={unit} onChange={setUnit} choices={UNIT_CHOICES} hint="Long lengths show in metres (m) or feet and inches (ft)." />
      </Card>

      <Card title="Look">
        <Stack>
          <ChoiceGroup legend="Theme" value={theme} onChange={setTheme} choices={THEME_CHOICES} hint="System follows your phone’s light or dark setting." />
          <Switch label="Show tips" description="Short how-to hints on the measuring screens." checked={showTips} onChange={setShowTips} />
        </Stack>
      </Card>

      <Card title="On-screen ruler" description="Forget this screen’s size check and do it again with a bank card.">
        <Button variant="outline" icon={Ruler} onClick={recalibrate}>
          Recalibrate on-screen ruler
        </Button>
      </Card>

      <Card title="History" description={history.length ? `${history.length} saved ${history.length === 1 ? 'measurement' : 'measurements'}.` : 'No saved measurements.'}>
        <Stack gap={3}>
          <div>
            <Button variant="outline" icon={Trash2} onClick={() => setConfirmClear(true)} disabled={!history.length || confirmClear}>
              Clear history
            </Button>
          </div>
          {confirmClear && (
            <div role="alertdialog" aria-labelledby="clear-title" className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive-soft p-4 text-destructive-soft-foreground">
              <p id="clear-title" className="font-semibold">
                Delete all {history.length} measurements and their photos? This can’t be undone.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" icon={Trash2} onClick={() => void clear()}>
                  Yes, delete all
                </Button>
                <Button variant="outline" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Stack>
      </Card>

      <Card title="About">
        <div className="flex flex-col gap-1 text-[15px]">
          <p className="font-semibold">Measure Sama</p>
          <p className="text-muted-foreground">Version {__APP_VERSION__}</p>
          <p>Everything stays on your phone. Measurements, photos and settings are never uploaded.</p>
        </div>
      </Card>
    </div>
  )
}
