import { STORAGE_PREFIX, storage } from '../lib/storage'
import { createStore } from './createStore'

export type ThemePreference = 'system' | 'light' | 'dark'

const THEME_KEY = `${STORAGE_PREFIX}theme`

// ---- Theme -----------------------------------------------------------------
export const themeStore = createStore<ThemePreference>(storage.get<ThemePreference>(THEME_KEY, 'system'))

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function resolvedTheme(pref: ThemePreference = themeStore.get()): 'light' | 'dark' {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref
}

export function applyTheme(): void {
  const dark = resolvedTheme() === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F0F0F' : '#F4F4F1')
}

export function setTheme(pref: ThemePreference): void {
  storage.set(THEME_KEY, pref)
  themeStore.set(pref)
  applyTheme()
}

if (typeof window !== 'undefined') {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (themeStore.get() === 'system') applyTheme()
  })
}

/** Remove every value this app stored on the device (settings and history). */
export function clearAllData(): void {
  storage.keys(STORAGE_PREFIX).forEach((k) => storage.remove(k))
  themeStore.set('system')
  applyTheme()
}
