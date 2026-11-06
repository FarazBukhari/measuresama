import { defaultUnitForLocale, isLengthUnit, type LengthUnit } from '../lib/units'
import { STORAGE_PREFIX, storage } from '../lib/storage'
import { createStore } from './createStore'

// Theme lives in preferences.ts (applied before the first render); re-exported so settings have one home.
export { setTheme, themeStore, type ThemePreference } from './preferences'

const UNIT_KEY = `${STORAGE_PREFIX}unit`
const TIPS_KEY = `${STORAGE_PREFIX}showTips`

function browserLocale(): string | undefined {
  return typeof navigator !== 'undefined' ? navigator.languages?.[0] ?? navigator.language : undefined
}

function loadUnit(): LengthUnit {
  const stored = storage.get<unknown>(UNIT_KEY, null)
  return isLengthUnit(stored) ? stored : defaultUnitForLocale(browserLocale())
}

function loadTips(): boolean {
  const stored = storage.get<unknown>(TIPS_KEY, true)
  return typeof stored === 'boolean' ? stored : true
}

/** Unit the user reads lengths in. Stored lengths are always metres; this only changes the display. */
export const unitStore = createStore<LengthUnit>(loadUnit())
/** Show the short how-to tips on the measuring screens. */
export const showTipsStore = createStore<boolean>(loadTips())

export function setUnit(unit: LengthUnit): void {
  if (!isLengthUnit(unit)) return
  storage.set(UNIT_KEY, unit)
  unitStore.set(unit)
}

export function setShowTips(show: boolean): void {
  storage.set(TIPS_KEY, show)
  showTipsStore.set(show)
}
