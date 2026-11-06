import { Monitor, Moon, Sun } from 'lucide-react'
import { resolvedTheme, setTheme, themeStore } from '../../state/preferences'
import { IconButton } from '../ui'

/** Cycles light → dark → system. */
export function ThemeToggle() {
  const pref = themeStore.use()
  const next = pref === 'light' ? 'dark' : pref === 'dark' ? 'system' : 'light'
  const icon = pref === 'system' ? Monitor : resolvedTheme(pref) === 'dark' ? Moon : Sun
  const label = `Theme: ${pref}. Switch to ${next}`
  return <IconButton icon={icon} label={label} onClick={() => setTheme(next)} />
}
