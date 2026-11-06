import { Capacitor } from '@capacitor/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { arErrorCode, availableArModes, canStartMode, checkArAvailability, isArMeasurement, requestArInstall, type ArAvailability, type ArStartResult } from './index'
import { ArMeasureWeb, WEB_UNSUPPORTED_REASON } from './web'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ArMeasure web fallback', () => {
  const web = new ArMeasureWeb()

  it('reports AR as unsupported in the browser', async () => {
    await expect(web.checkAvailability()).resolves.toEqual({ status: 'unsupported', platform: 'web', reason: WEB_UNSUPPORTED_REASON, modes: [] })
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
  const P = (x: number, y: number, z: number) => ({ x, y, z })
  const base = { cancelled: false, unit: 'cm', createdAt: '2026-01-01T00:00:00Z' }
  const valid: Record<string, Record<string, unknown>> = {
    distance: { mode: 'distance', points: [P(0, 0, 0), P(1, 0, 0)], distanceM: 1 },
    path: { mode: 'path', points: [P(0, 0, 0), P(1, 0, 0), P(1, 0, 1)], segmentsM: [1, 1], distanceM: 2 },
    area: { mode: 'area', points: [P(0, 0, 0), P(1, 0, 0), P(1, 0, 1)], segmentsM: [1, 1, 1.41421], perimeterM: 3.41421, areaM2: 0.5, distanceM: 3.41421 },
    angle: { mode: 'angle', points: [P(1, 0, 0), P(0, 0, 0), P(0, 0, 1)], angleDeg: 90, segmentsM: [1, 1] },
    height: { mode: 'height', points: [P(0, 0, 0), P(0, 2, 0)], heightM: 2, distanceM: 2 },
    volume: { mode: 'volume', points: [P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(1, 1, 1)], lengthM: 1, widthM: 1, heightM: 1, areaM2: 1, volumeM3: 1 },
    'room-plan': { mode: 'room-plan', points: [P(0, 0, 0), P(3, 0, 0), P(3, 0, 3)], segmentsM: [3, 3, 4.24264], perimeterM: 10.24264, areaM2: 4.5, distanceM: 10.24264 },
  }
  const check = (r: Record<string, unknown>) => isArMeasurement({ ...base, ...r } as unknown as ArStartResult)

  it('tells measurements from cancellations', () => {
    expect(isArMeasurement({ cancelled: true, reason: 'user' })).toBe(false)
    expect(isArMeasurement(null)).toBe(false)
    expect(isArMeasurement({ cancelled: false, mode: 'distance', unit: 'cm', points: [], distanceM: 1, createdAt: '2026-01-01T00:00:00Z' })).toBe(true)
  })

  it.each(Object.keys(valid))('accepts a full %s result', (mode) => {
    expect(check(valid[mode])).toBe(true)
  })

  it('accepts a room plan with a wall height, and rejects a bad one', () => {
    expect(check({ ...valid['room-plan'], wallHeightM: 2.4 })).toBe(true)
    expect(check({ ...valid['room-plan'], wallHeightM: -1 })).toBe(false)
  })

  it.each([
    ['distance', { distanceM: undefined }],
    ['distance', { distanceM: -1 }],
    ['distance', { distanceM: Number.NaN }],
    ['path', { segmentsM: undefined }],
    ['path', { segmentsM: [1, Number.POSITIVE_INFINITY] }],
    ['area', { areaM2: undefined }],
    ['area', { perimeterM: 'long' }],
    ['area', { segmentsM: [1, -1, 1] }],
    ['angle', { angleDeg: 181 }],
    ['angle', { segmentsM: undefined }],
    ['height', { heightM: undefined }],
    ['volume', { volumeM3: undefined }],
    ['volume', { widthM: -0.1 }],
    ['room-plan', { segmentsM: undefined }],
    ['distance', { points: [{ x: 0, y: 0 }] }],
    ['distance', { points: undefined }],
    ['distance', { mode: 'photo' }],
    ['distance', { mode: 'teleport' }],
  ])('rejects %s with %o', (mode, over) => {
    expect(check({ ...valid[mode], ...over })).toBe(false)
  })
})

describe('availableArModes', () => {
  const supported: ArAvailability = { status: 'supported', platform: 'android' }
  it('treats a build without modes as distance only', () => {
    expect(availableArModes(supported)).toEqual(['distance'])
    expect(canStartMode(supported, 'distance')).toBe(true)
    expect(canStartMode(supported, 'area')).toBe(false)
  })
  it('uses the modes the build reports', () => {
    const a: ArAvailability = { ...supported, modes: ['distance', 'path', 'area', 'angle', 'height', 'volume', 'room-plan'] }
    expect(availableArModes(a)).toEqual(['distance', 'path', 'area', 'angle', 'height', 'volume', 'room-plan'])
    expect(canStartMode(a, 'room-plan')).toBe(true)
    expect(canStartMode(a, 'photo')).toBe(false)
  })
  it('never offers photo or unknown modes to the plugin', () => {
    expect(availableArModes({ ...supported, modes: ['photo', 'teleport', 'height'] as ArAvailability['modes'] })).toEqual(['height'])
  })
  it('offers nothing unless AR is supported', () => {
    for (const status of ['needs-install', 'needs-update', 'unsupported', 'unknown'] as const) {
      expect(availableArModes({ status, platform: 'android', modes: ['distance', 'area'] })).toEqual([])
    }
    expect(availableArModes(null)).toEqual([])
    expect(canStartMode({ status: 'unsupported', platform: 'web', modes: [] }, 'distance')).toBe(false)
  })
})

describe('arErrorCode', () => {
  it('only returns known codes', () => {
    expect(arErrorCode({ code: 'BUSY' })).toBe('BUSY')
    expect(arErrorCode({ code: 'NOPE' })).toBeUndefined()
    expect(arErrorCode(null)).toBeUndefined()
  })
})
