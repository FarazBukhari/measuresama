import { afterEach, describe, expect, it, vi } from 'vitest'

async function freshSettings() {
  vi.resetModules()
  return import('./settings')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('settings', () => {
  it('defaults the unit from the phone language', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
    expect((await freshSettings()).unitStore.get()).toBe('in')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR'])
    expect((await freshSettings()).unitStore.get()).toBe('cm')
  })

  it('remembers the unit and tips after a reload', async () => {
    // US English defaults to inches, so centimetres can only come back from storage.
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
    const s = await freshSettings()
    expect(s.unitStore.get()).toBe('in')
    s.setUnit('cm')
    s.setShowTips(false)
    expect(localStorage.getItem('measuresama:unit')).toBe('"cm"')
    const reloaded = await freshSettings()
    expect(reloaded.unitStore.get()).toBe('cm')
    expect(reloaded.showTipsStore.get()).toBe(false)
  })

  it('ignores corrupt stored values', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB'])
    localStorage.setItem('measuresama:unit', '"furlongs"')
    localStorage.setItem('measuresama:showTips', '{oops')
    const s = await freshSettings()
    expect(s.unitStore.get()).toBe('cm')
    expect(s.showTipsStore.get()).toBe(true)
  })
})
