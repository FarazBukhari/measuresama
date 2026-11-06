import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

export const STORAGE_PREFIX = 'measuresama:'

/**
 * Set in the native store once the WebView's data has been copied into it.
 * Outside STORAGE_PREFIX on purpose, so "clear all data" never removes it.
 */
export const NATIVE_STORE_MARKER = 'measuresama-native-store-v1'

/**
 * In the app, every write also goes to the native store (@capacitor/preferences), because
 * the Android WebView only commits localStorage to disk about 5 s after a write: a user who
 * saves a measurement and swipes the app away sooner would lose it. localStorage stays the
 * fast synchronous copy the UI reads; hydrateStorage() refreshes it from the native store at
 * launch. On the web there is no native store and localStorage is the only copy.
 */
function nativeStoreOn(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Preferences')
  } catch {
    return false
  }
}

function mirrorSet(key: string, raw: string): void {
  if (!key.startsWith(STORAGE_PREFIX) || !nativeStoreOn()) return
  Preferences.set({ key, value: raw }).catch(() => undefined)
}

function mirrorRemove(key: string): void {
  if (!key.startsWith(STORAGE_PREFIX) || !nativeStoreOn()) return
  Preferences.remove({ key }).catch(() => undefined)
}

function localKeys(prefix: string): string[] {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(prefix))
  } catch {
    return []
  }
}

/** Safe storage access — never throws (private mode, quota, disabled storage). */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown): void {
    let raw: string
    try {
      raw = JSON.stringify(value)
    } catch {
      return
    }
    try {
      localStorage.setItem(key, raw)
    } catch {
      /* ignore quota / privacy errors */
    }
    mirrorSet(key, raw)
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    mirrorRemove(key)
  },
  keys(prefix = ''): string[] {
    return localKeys(prefix)
  },
}

/**
 * Run once at launch, before any store reads storage. In the app, the native store wins:
 * its copy reaches disk at once, while the WebView's copy can be a few seconds behind.
 * The first launch with the native store copies the WebView's data into it instead.
 * Gives up after `timeoutMs` so a stuck plugin never blanks the app; a late result is ignored.
 */
export async function hydrateStorage(timeoutMs = 2000): Promise<void> {
  if (!nativeStoreOn()) return
  let timedOut = false

  const work = async () => {
    const { value: marker } = await Preferences.get({ key: NATIVE_STORE_MARKER })
    if (marker !== '1') {
      const entries = localKeys(STORAGE_PREFIX).map((k) => [k, localStorage.getItem(k)] as const)
      await Promise.all(entries.map(([key, value]) => (value === null ? undefined : Preferences.set({ key, value }))))
      await Preferences.set({ key: NATIVE_STORE_MARKER, value: '1' })
      return
    }
    const { keys } = await Preferences.keys()
    const ours = keys.filter((k) => k.startsWith(STORAGE_PREFIX))
    const entries = await Promise.all(ours.map(async (key) => [key, (await Preferences.get({ key })).value] as const))
    if (timedOut) return
    try {
      for (const k of localKeys(STORAGE_PREFIX)) if (!ours.includes(k)) localStorage.removeItem(k)
      for (const [k, v] of entries) if (v !== null) localStorage.setItem(k, v)
    } catch {
      /* localStorage unavailable: the app falls back to defaults */
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true
      resolve()
    }, timeoutMs)
  })
  await Promise.race([work().catch(() => undefined), timeout])
  clearTimeout(timer)
}
