import { Capacitor } from '@capacitor/core'
import { toast } from '../state/toast'

/**
 * Saving files works differently in the browser and in the native app:
 * - Browser / PWA: a normal download via <a download>.
 * - Android / iOS app: the WebView ignores <a download>, so the file is written with
 *   the Filesystem plugin into a "Measure Sama" folder (Documents on Android, the app's
 *   folder in the Files app on iOS) and a toast offers to share it. If that fails, the
 *   system share sheet opens so the user can still save or send the file.
 */

export const APP_FOLDER = 'Measure Sama'

export type SaveResult =
  | { method: 'download' }
  | { method: 'saved'; uri: string; path: string }
  | { method: 'shared' }
  | { method: 'failed'; error: string }

/** Remove characters that are not allowed in file names on Android/iOS/Windows. */
export function safeFileName(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex -- control characters are exactly what must be removed
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
  return cleaned.slice(0, 120) || 'download'
}

/** "photo.jpg", 2 → "photo (2).jpg" */
export function numberedFileName(name: string, n: number): string {
  if (n <= 1) return name
  const dot = name.lastIndexOf('.')
  return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`
}

/** Where saved files end up, in words the user recognises. */
export function savedLocationLabel(platform = Capacitor.getPlatform()): string {
  return platform === 'ios' ? `Files › On My iPhone › ${APP_FOLDER}` : `Documents › ${APP_FOLDER}`
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'))
    reader.readAsDataURL(blob)
  })
}

/** Decode a data: URL into a Blob without a network round-trip. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const head = dataUrl.slice(0, comma)
  const body = dataUrl.slice(comma + 1)
  const mime = /^data:([^;,]+)/.exec(head)?.[1] ?? 'application/octet-stream'
  if (!head.includes(';base64')) return new Blob([decodeURIComponent(body)], { type: mime })
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function browserDownload(href: string, filename: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

async function shareFile(uri: string, filename: string): Promise<void> {
  const { Share } = await import('@capacitor/share')
  await Share.share({ title: filename, files: [uri], dialogTitle: `Save or share ${filename}` })
}

const isCancel = (e: unknown) => /cancel/i.test(e instanceof Error ? e.message : String(e))

type FilesystemModule = typeof import('@capacitor/filesystem')

/**
 * Names already in the app's folder. Listing (rather than probing single files with
 * stat) never fails for a missing file, so it doesn't fill the console with errors.
 */
async function existingNames(fs: FilesystemModule['Filesystem'], documents: FilesystemModule['Directory']['Documents']): Promise<Set<string>> {
  try {
    const root = await fs.readdir({ path: '', directory: documents })
    if (!root.files.some((f) => f.name === APP_FOLDER)) return new Set()
    const { files } = await fs.readdir({ path: APP_FOLDER, directory: documents })
    return new Set(files.map((f) => f.name))
  } catch {
    return new Set()
  }
}

async function saveNative(blob: Blob, filename: string): Promise<SaveResult> {
  const { Directory, Filesystem } = await import('@capacitor/filesystem')
  const name = safeFileName(filename)
  const data = await blobToBase64(blob)

  try {
    // Pick a free name so earlier downloads are never overwritten.
    const taken = await existingNames(Filesystem, Directory.Documents)
    let savedName = name
    for (let n = 2; taken.has(savedName) && n < 10_000; n++) savedName = numberedFileName(name, n)
    const path = `${APP_FOLDER}/${savedName}`
    const { uri } = await Filesystem.writeFile({ path, data, directory: Directory.Documents, recursive: true })
    toast(`Saved “${savedName}” to ${savedLocationLabel()}`, 'success', {
      action: { label: 'Share', onClick: () => void shareFile(uri, savedName).catch(() => undefined) },
    })
    return { method: 'saved', uri, path }
  } catch {
    // Storage not writable (permission denied, full disk…): hand the file to the share sheet instead.
    try {
      const { uri } = await Filesystem.writeFile({ path: `share/${name}`, data, directory: Directory.Cache, recursive: true })
      await shareFile(uri, name)
      return { method: 'shared' }
    } catch (e) {
      if (isCancel(e)) return { method: 'shared' }
      const error = e instanceof Error ? e.message : String(e)
      toast('Could not save the file on this device', 'error')
      return { method: 'failed', error }
    }
  }
}

function nativeFailure(e: unknown): SaveResult {
  toast('Could not save the file on this device', 'error')
  return { method: 'failed', error: e instanceof Error ? e.message : String(e) }
}

/** Save a Blob as a file (download in the browser, saved to the device in the app). */
export async function downloadBlob(blob: Blob, filename: string): Promise<SaveResult> {
  if (Capacitor.isNativePlatform()) return saveNative(blob, filename).catch(nativeFailure)
  const url = URL.createObjectURL(blob)
  browserDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { method: 'download' }
}

function photoId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

/**
 * Keep a measurement photo in the app's private storage (app only), next to the AR photos:
 * Data/measurements/<uuid>.jpg. Gives its file:// URI, or undefined on the web or if it can't be
 * written. No toast, never rejects: the measurement is still saved without the photo.
 */
export async function saveAppPhoto(blob: Blob): Promise<string | undefined> {
  if (!Capacitor.isNativePlatform()) return undefined
  try {
    const { Directory, Filesystem } = await import('@capacitor/filesystem')
    const data = await blobToBase64(blob)
    const { uri } = await Filesystem.writeFile({ path: `measurements/${photoId()}.jpg`, data, directory: Directory.Data, recursive: true })
    return uri || undefined
  } catch {
    return undefined
  }
}

/** Save plain text content as a file. */
export function downloadText(text: string, filename: string, mime = 'text/plain'): Promise<SaveResult> {
  return downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename)
}

/** Save a data: URL (e.g. canvas.toDataURL()) as a file. */
export async function downloadDataUrl(dataUrl: string, filename: string): Promise<SaveResult> {
  if (!Capacitor.isNativePlatform()) {
    browserDownload(dataUrl, filename)
    return { method: 'download' }
  }
  try {
    return await saveNative(dataUrlToBlob(dataUrl), filename)
  } catch (e) {
    return nativeFailure(e)
  }
}
