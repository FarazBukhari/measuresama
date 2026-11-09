import type { Point2D } from '../../lib/geometry'

/**
 * Photo loading and export for photo measure. Phones run out of memory on big photos, so:
 * decode once with createImageBitmap, draw into one capped working canvas, close the bitmap,
 * release canvases (width = height = 0) when done, and never wait forever on canvas.toBlob.
 */

/** Long edge of the working image. Plenty for placing corners, small enough for any phone. */
export const MAX_EDGE = 2048
/** Biggest canvas iOS allows (about 16.7 MP). */
export const MAX_AREA = 16_777_216
/** Long edge of the saved, annotated photo. */
export const SAVE_EDGE = 1600

export interface DecodedPhoto {
  /** The working image, already upright and downscaled. */
  canvas: HTMLCanvasElement
  width: number
  height: number
}

export class PhotoDecodeError extends Error {
  constructor(message = 'Can’t open this photo') {
    super(message)
    this.name = 'PhotoDecodeError'
  }
}

/** Integer size that keeps the aspect ratio, a long edge <= maxEdge and an area <= maxArea. Never upscales. */
export function fitSize(width: number, height: number, maxEdge = MAX_EDGE, maxArea = MAX_AREA): { width: number; height: number } {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) return { width: 0, height: 0 }
  const scale = Math.min(1, maxEdge / Math.max(width, height), Math.sqrt(maxArea / (width * height)))
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) }
}

/** Free a canvas's pixel memory now instead of whenever the garbage collector runs. */
export function releaseCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return
  canvas.width = 0
  canvas.height = 0
}

/** Fallback for browsers without createImageBitmap options. <img> applies EXIF orientation by itself. */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new PhotoDecodeError())
    }
    img.src = url
  })
}

/** Decode a picked photo into an upright working canvas. Throws PhotoDecodeError if it can't be read. */
export async function decodePhoto(file: Blob): Promise<DecodedPhoto> {
  let bitmap: ImageBitmap | null = null
  let img: HTMLImageElement | null = null
  try {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      img = await loadImage(file)
    }
    const srcW = bitmap ? bitmap.width : img!.naturalWidth
    const srcH = bitmap ? bitmap.height : img!.naturalHeight
    const { width, height } = fitSize(srcW, srcH)
    if (!width || !height) throw new PhotoDecodeError()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      releaseCanvas(canvas)
      throw new PhotoDecodeError()
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage((bitmap ?? img)!, 0, 0, width, height)
    return { canvas, width, height }
  } catch (e) {
    throw e instanceof PhotoDecodeError ? e : new PhotoDecodeError()
  } finally {
    bitmap?.close()
    if (img) img.src = ''
  }
}

/** canvas.toBlob that gives null instead of hanging (it can silently never call back on phones). */
export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.85, timeoutMs = 10_000): Promise<Blob | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (b: Blob | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(b)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    try {
      canvas.toBlob(finish, type, quality)
    } catch {
      finish(null)
    }
  })
}

export interface AnnotatedLine {
  a: Point2D
  b: Point2D
  label: string
}

/**
 * The photo with the card outline, the lines and their lengths drawn on, as a JPEG with a long
 * edge of at most SAVE_EDGE px. Null if the phone can't make it.
 */
export async function composeAnnotatedJpeg(photo: DecodedPhoto, card: readonly Point2D[], lines: readonly AnnotatedLine[]): Promise<Blob | null> {
  const { width, height } = fitSize(photo.width, photo.height, SAVE_EDGE)
  if (!width || !height) return null
  const s = width / photo.width
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(photo.canvas, 0, 0, width, height)
    const long = Math.max(width, height)
    const lw = Math.max(2, Math.round(long / 400))
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    ctx.beginPath()
    card.forEach((p, i) => (i ? ctx.lineTo(p.x * s, p.y * s) : ctx.moveTo(p.x * s, p.y * s)))
    ctx.closePath()
    // Tape palette: white card outline on a dark edge, tape-yellow lines, lengths on yellow pills.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.lineWidth = lw * 2.5
    ctx.stroke()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = lw
    ctx.stroke()

    const font = Math.max(14, Math.round(long / 40))
    ctx.font = `800 ${font}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const line of lines) {
      const a = { x: line.a.x * s, y: line.a.y * s }
      const b = { x: line.b.x * s, y: line.b.y * s }
      for (const [color, w] of [
        ['rgba(0, 0, 0, 0.7)', lw * 2.5],
        ['#FFC629', lw],
      ] as const) {
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = color
        ctx.lineWidth = w
        ctx.stroke()
      }
      for (const p of [a, b]) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, lw * 2, 0, Math.PI * 2)
        ctx.fillStyle = '#FFC629'
        ctx.fill()
      }
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2 - font
      const tw = ctx.measureText(line.label).width + font * 0.8
      ctx.fillStyle = '#FFC629'
      ctx.beginPath()
      ctx.roundRect(mx - tw / 2, my - font * 0.75, tw, font * 1.5, font * 0.75)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.lineWidth = Math.max(1, lw / 2)
      ctx.stroke()
      ctx.fillStyle = '#141414'
      ctx.fillText(line.label, mx, my)
    }
    return await canvasToBlob(canvas, 'image/jpeg', 0.85)
  } finally {
    releaseCanvas(canvas)
  }
}
