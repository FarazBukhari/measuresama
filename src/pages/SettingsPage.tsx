import { Lock, Monitor, Moon, Ruler, Sun, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, List, ListRow, Switch } from '../components/ui'
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

const THEME_CHOICES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

const sectionLabel = 'mb-2 text-sm font-semibold text-muted-foreground'

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
    <div className="flex flex-col">
      <PageHeader title="Settings" />

      <div className="flex flex-col gap-6">
        <section>
          <h2 className={sectionLabel}>Units</h2>
          <ChoiceGroup legend="Units" value={unit} onChange={setUnit} choices={UNIT_CHOICES} className="[&>legend]:sr-only" />
        </section>

        <section>
          <h2 className={sectionLabel}>Look</h2>
          <div className="flex flex-col gap-3">
            <ChoiceGroup legend="Theme" value={theme} onChange={setTheme} choices={THEME_CHOICES} className="[&>legend]:sr-only" />
            <List>
              <li className="px-4 py-2">
                <Switch label="Show tips" checked={showTips} onChange={setShowTips} />
              </li>
            </List>
          </div>
        </section>

        <section>
          <h2 className={sectionLabel}>Ruler and history</h2>
          <div className="flex flex-col gap-3">
            <List>
              <ListRow as="button" leading={<Ruler aria-hidden="true" />} label="Recalibrate on-screen ruler" chevron onClick={recalibrate} />
              <ListRow
                as="button"
                leading={<Trash2 aria-hidden="true" />}
                label="Clear history"
                trailing={<span className="text-muted-foreground tabular-nums">{history.length}</span>}
                disabled={!history.length || confirmClear}
                onClick={() => setConfirmClear(true)}
              />
            </List>
            {confirmClear && (
              <div role="alertdialog" aria-labelledby="clear-title" className="flex flex-col gap-3 rounded-[20px] bg-destructive-soft p-4 text-destructive-soft-foreground">
                <p id="clear-title" className="font-semibold">
                  Delete all {history.length} measurements and photos?
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" onClick={() => void clear()}>
                    Yes, delete all
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className={sectionLabel}>About</h2>
          <List>
            <ListRow label="Version" trailing={<span className="text-muted-foreground tabular-nums">{__APP_VERSION__}</span>} />
            <ListRow leading={<Lock aria-hidden="true" />} label="Stays on your phone" />
          </List>
        </section>
      </div>
    </div>
  )
}
