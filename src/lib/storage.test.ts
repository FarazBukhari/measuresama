import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = { on: false }
const prefs = new Map<string, string>()
const hang = { get: false }

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native.on,
    isPluginAvailable: (name: string) => native.on && name === 'Preferences',
  },
}))

const Preferences = {
  get: vi.fn(async ({ key }: { key: string }) => {
    if (hang.get) return new Promise<never>(() => undefined)
    return { value: prefs.has(key) ? prefs.get(key)! : null }
  }),
  set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
    prefs.set(key, value)
  }),
  remove: vi.fn(async ({ key }: { key: string }) => {
    prefs.delete(key)
  }),
  keys: vi.fn(async () => ({ keys: [...prefs.keys()] })),
}
vi.mock('@capacitor/preferences', () => ({ Preferences }))

const { NATIVE_STORE_MARKER, hydrateStorage, storage } = await import('./storage')

beforeEach(() => {
  native.on = false
  hang.get = false
  prefs.clear()
  localStorage.clear()
  vi.clearAllMocks()
})

describe('storage on the web', () => {
  it('uses localStorage only', async () => {
    storage.set('measuresama:unit', 'cm')
    expect(localStorage.getItem('measuresama:unit')).toBe('"cm"')
    expect(storage.get('measuresama:unit', 'in')).toBe('cm')
    storage.remove('measuresama:unit')
    expect(localStorage.getItem('measuresama:unit')).toBeNull()
    await hydrateStorage()
    expect(Preferences.set).not.toHaveBeenCalled()
    expect(Preferences.remove).not.toHaveBeenCalled()
    expect(Preferences.get).not.toHaveBeenCalled()
  })

  it('returns the fallback for missing or broken values', () => {
    localStorage.setItem('measuresama:broken', '{nope')
    expect(storage.get('measuresama:broken', 7)).toBe(7)
    expect(storage.get('measuresama:missing', 'x')).toBe('x')
  })
})

describe('storage in the app', () => {
  beforeEach(() => {
    native.on = true
  })

  it('mirrors app keys to the native store', async () => {
    storage.set('measuresama:unit', 'cm')
    storage.set('other:key', 1)
    await Promise.resolve()
    expect(prefs.get('measuresama:unit')).toBe('"cm"')
    expect(prefs.has('other:key')).toBe(false)
    storage.remove('measuresama:unit')
    await Promise.resolve()
    expect(prefs.has('measuresama:unit')).toBe(false)
    expect(localStorage.getItem('measuresama:unit')).toBeNull()
  })

  it('first launch copies the WebView data into the native store', async () => {
    localStorage.setItem('measuresama:unit', '"in"')
    localStorage.setItem('measuresama:history', '{"version":1,"items":[]}')
    localStorage.setItem('unrelated', '1')
    await hydrateStorage()
    expect(prefs.get('measuresama:unit')).toBe('"in"')
    expect(prefs.get('measuresama:history')).toBe('{"version":1,"items":[]}')
    expect(prefs.has('unrelated')).toBe(false)
    expect(prefs.get(NATIVE_STORE_MARKER)).toBe('1')
    expect(localStorage.getItem('measuresama:unit')).toBe('"in"')
  })

  it('later launches take the native copy, which never lags', async () => {
    prefs.set(NATIVE_STORE_MARKER, '1')
    prefs.set('measuresama:unit', '"cm"')
    prefs.set('measuresama:history', '{"version":1,"items":[{"id":"a"}]}')
    // The WebView lost the last writes (app killed within ~5 s) and still has stale data.
    localStorage.setItem('measuresama:unit', '"in"')
    localStorage.setItem('measuresama:tips', 'false')
    localStorage.setItem('unrelated', 'keep')
    await hydrateStorage()
    expect(localStorage.getItem('measuresama:unit')).toBe('"cm"')
    expect(localStorage.getItem('measuresama:history')).toBe('{"version":1,"items":[{"id":"a"}]}')
    // Removed from the native store, so it was cleared there: drop the stale WebView copy too.
    expect(localStorage.getItem('measuresama:tips')).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('keep')
  })

  it('gives up after the timeout and ignores a late answer', async () => {
    vi.useFakeTimers()
    try {
      prefs.set(NATIVE_STORE_MARKER, '1')
      localStorage.setItem('measuresama:unit', '"in"')
      hang.get = true
      const done = hydrateStorage(50)
      await vi.advanceTimersByTimeAsync(60)
      await done
      expect(localStorage.getItem('measuresama:unit')).toBe('"in"')
    } finally {
      vi.useRealTimers()
    }
  })

  it('never throws when the native store fails', async () => {
    Preferences.get.mockRejectedValueOnce(new Error('broken'))
    localStorage.setItem('measuresama:unit', '"in"')
    await expect(hydrateStorage()).resolves.toBeUndefined()
    expect(localStorage.getItem('measuresama:unit')).toBe('"in"')
    Preferences.set.mockRejectedValueOnce(new Error('broken'))
    expect(() => storage.set('measuresama:unit', 'cm')).not.toThrow()
  })
})
