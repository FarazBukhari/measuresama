import { Capacitor } from '@capacitor/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { arErrorCode, checkArAvailability, isArMeasurement, requestArInstall } from './index'
import { ArMeasureWeb, WEB_UNSUPPORTED_REASON } from './web'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ArMeasure web fallback', () => {
  const web = new ArMeasureWeb()

  it('reports AR as unsupported in the browser', async () => {
    await expect(web.checkAvailability()).resolves.toEqual({ status: 'unsupported', platform: 'web', reason: WEB_UNSUPPORTED_REASON })
    await expect(web.requestInstall()).resolves.toEqual({ status: 'unsupported' })
  })

  it('rejects distance with UNAVAILABLE', async () => {
    const e = await web.start({ mode: 'distance', unit: 'cm' }).catch((err: unknown) => err)
    expect(arErrorCode(e)).toBe('UNAVAILABLE')
  })

  it('rejects other modes with NOT_IMPLEMENTED first', async () => {
    const e = await web.start({ mode: 'area', unit: 'in' }).catch((err: unknown) => err)
    expect(arErrorCode(e)).toBe('NOT_IMPLEMENTED')
    expect((e as Error).message).toBe('This measuring mode is coming soon.')
  })
})

describe('guarded calls', () => {
  it('uses the web fallback in the browser', async () => {
    await expect(checkArAvailability()).resolves.toMatchObject({ status: 'unsupported', platform: 'web' })
  })

  it('never calls a plugin the app does not have', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true)
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')
    const available = vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(false)
    await expect(checkArAvailability()).resolves.toMatchObject({ status: 'unsupported', platform: 'android' })
    await expect(requestArInstall()).resolves.toBe('unsupported')
    expect(available).toHaveBeenCalledWith('ArMeasure')
  })
})

describe('isArMeasurement', () => {
  it('tells measurements from cancellations', () => {
    expect(isArMeasurement({ cancelled: true, reason: 'user' })).toBe(false)
    expect(isArMeasurement(null)).toBe(false)
    expect(
      isArMeasurement({ cancelled: false, mode: 'distance', unit: 'cm', points: [], distanceM: 1, createdAt: '2026-01-01T00:00:00Z' }),
    ).toBe(true)
  })
})

describe('arErrorCode', () => {
  it('only returns known codes', () => {
    expect(arErrorCode({ code: 'BUSY' })).toBe('BUSY')
    expect(arErrorCode({ code: 'NOPE' })).toBeUndefined()
    expect(arErrorCode(null)).toBeUndefined()
  })
})
