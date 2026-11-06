import { afterEach, describe, expect, it, vi } from 'vitest'
import { canvasToBlob, decodePhoto, fitSize, MAX_EDGE, PhotoDecodeError, releaseCanvas } from './image'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('fitSize', () => {
  it('keeps small photos as they are', () => {
    expect(fitSize(1600, 1000)).toEqual({ width: 1600, height: 1000 })
  })

  it('caps the long edge of big photos and keeps the shape', () => {
    expect(fitSize(4000, 3000)).toEqual({ width: MAX_EDGE, height: 1536 })
    expect(fitSize(3000, 4000)).toEqual({ width: 1536, height: MAX_EDGE })
    expect(fitSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
  })

  it('caps the area too', () => {
    const { width, height } = fitSize(10_000, 10_000, 100_000, 1_000_000)
    expect(width * height).toBeLessThanOrEqual(1_000_000)
  })

  it('gives 0 × 0 for an empty or broken size', () => {
    expect(fitSize(0, 100)).toEqual({ width: 0, height: 0 })
    expect(fitSize(Number.NaN, 100)).toEqual({ width: 0, height: 0 })
  })
})

describe('decodePhoto', () => {
  it('reports a photo it cannot open', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('bad image'))))
    const OriginalImage = globalThis.Image
    class BrokenImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(v: string) {
        if (v) queueMicrotask(() => this.onerror?.())
      }
    }
    vi.stubGlobal('Image', BrokenImage)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    await expect(decodePhoto(new Blob(['not an image']))).rejects.toBeInstanceOf(PhotoDecodeError)
    vi.stubGlobal('Image', OriginalImage)
  })

  it('closes the decoded bitmap', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close })))
    const drawImage = vi.fn()
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
    const photo = await decodePhoto(new Blob(['x']))
    expect(photo).toMatchObject({ width: 2048, height: 1536 })
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1536)
    expect(close).toHaveBeenCalled()
    getContext.mockRestore()
  })
})

describe('canvas helpers', () => {
  it('releases canvas memory', () => {
    const c = document.createElement('canvas')
    c.width = 100
    c.height = 50
    releaseCanvas(c)
    expect([c.width, c.height]).toEqual([0, 0])
  })

  it('gives up on toBlob that never calls back', async () => {
    vi.useFakeTimers()
    const c = { toBlob: vi.fn() } as unknown as HTMLCanvasElement
    const result = canvasToBlob(c, 'image/jpeg', 0.85, 1000)
    vi.advanceTimersByTime(1000)
    await expect(result).resolves.toBeNull()
  })
})
