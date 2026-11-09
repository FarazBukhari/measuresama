import type { Page } from '@playwright/test'

/**
 * A photo for photo-measure tests, drawn in the page with a canvas (no binary in git), so the
 * same helper works in Playwright web and in the Android WebView. 10 px per mm, no perspective:
 * - white 1600 × 1000 background with light, seeded noise
 * - a dark card, axis-aligned, 856 × 540 px at (100, 100): 85.6 × 54.0 mm
 * - a 100.0 mm bar from (100, 800) to (1100, 800)
 */
export const PHOTO_FIXTURE = {
  width: 1600,
  height: 1000,
  card: [
    { x: 100, y: 100 },
    { x: 956, y: 100 },
    { x: 956, y: 640 },
    { x: 100, y: 640 },
  ],
  bar: { a: { x: 100, y: 800 }, b: { x: 1100, y: 800 } },
  barMm: 100,
} as const

/** Runs inside the page. Must stay self-contained (it is serialised by page.evaluate). */
function drawFixture(): string {
  const w = 1600
  const h = 1000
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  let seed = 12345
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const v = 255 - (seed % 24)
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  ctx.fillStyle = '#1f2937'
  ctx.fillRect(100, 100, 856, 540)
  ctx.strokeStyle = '#7f1d1d'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(100, 800)
  ctx.lineTo(1100, 800)
  ctx.stroke()
  const url = canvas.toDataURL('image/png')
  canvas.width = 0
  canvas.height = 0
  return url
}

/** The fixture as PNG bytes, for `setInputFiles({ name, mimeType, buffer })`. */
export async function photoFixtureBuffer(page: Page): Promise<Buffer> {
  const url = await page.evaluate(drawFixture)
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
}

/**
 * For WebViews, where setInputFiles can't reach host files: build the File in the page, put it on
 * the input with DataTransfer and fire 'change' the way a real pick does.
 */
export async function setPhotoFixtureInPage(page: Page, inputSelector: string): Promise<void> {
  const url = await page.evaluate(drawFixture)
  await page.evaluate(
    ({ url, selector }) => {
      const bin = atob(url.slice(url.indexOf(',') + 1))
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/png' })
      const input = document.querySelector<HTMLInputElement>(selector)
      if (!input) throw new Error(`No file input at ${selector}`)
      const dt = new DataTransfer()
      dt.items.add(new File([blob], 'fixture.png', { type: 'image/png' }))
      input.files = dt.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    },
    { url, selector: inputSelector },
  )
}
