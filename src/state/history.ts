import { Capacitor } from '@capacitor/core'
import { downloadText, type SaveResult } from '../lib/download'
import type { Point2D } from '../lib/geometry'
import { STORAGE_PREFIX, storage } from '../lib/storage'
import { isLengthUnit, type LengthUnit } from '../lib/units'
import { resultSummary } from '../modes/results/summary'
import type { ArMeasurement, ArMode, ArPoint } from '../plugins/ar-measure/definitions'
import { createStore } from './createStore'

/**
 * Saved measurements, stored on this device only. Values are always metres, m², m³ or degrees
 * (never display strings) and photos stay as files: only their file:// URI is stored here.
 */

export const HISTORY_KEY = `${STORAGE_PREFIX}history`
export const HISTORY_VERSION = 2

/** A line drawn on a photo, in image pixels, with its real length. */
export interface PhotoLine {
  a: Point2D
  b: Point2D
  lengthM: number
}

/** Photo measure: the card used for scale (4 corners, clockwise from top-left) and the lines drawn. */
export interface PhotoMeasurement {
  imageWidth: number
  imageHeight: number
  card: Point2D[]
  lines: PhotoLine[]
}

/**
 * One saved measurement. Which numbers are set depends on the mode:
 * distance: distanceM · path: distanceM, segmentsM · area: areaM2, perimeterM (+ segmentsM, distanceM) ·
 * angle: angleDeg (+ segmentsM) · height: heightM (+ distanceM) · volume: lengthM, widthM, heightM, volumeM3 (+ areaM2) ·
 * room-plan: areaM2, perimeterM, segmentsM (+ wallHeightM, distanceM) · photo: photo, distanceM = first line, points [].
 */
export interface HistoryItem {
  id: string
  mode: ArMode
  /** Unit the user saw while measuring. */
  unit: LengthUnit
  /** ISO 8601 UTC. */
  createdAt: string
  points: ArPoint[]
  /** file:// URI of the photo in app-private storage. */
  screenshotUri?: string
  note?: string
  distanceM?: number
  segmentsM?: number[]
  perimeterM?: number
  areaM2?: number
  angleDeg?: number
  heightM?: number
  lengthM?: number
  widthM?: number
  volumeM3?: number
  wallHeightM?: number
  photo?: PhotoMeasurement
}

export interface HistoryFile {
  version: typeof HISTORY_VERSION
  items: HistoryItem[]
}

const MODES: readonly string[] = ['distance', 'path', 'area', 'angle', 'height', 'volume', 'room-plan', 'photo']
const NUMBER_FIELDS = ['distanceM', 'perimeterM', 'areaM2', 'angleDeg', 'heightM', 'lengthM', 'widthM', 'volumeM3', 'wallHeightM'] as const
type NumberField = (typeof NUMBER_FIELDS)[number]

const REQUIRED: Record<ArMode, readonly (NumberField | 'segmentsM' | 'photo')[]> = {
  distance: ['distanceM'],
  path: ['distanceM', 'segmentsM'],
  area: ['areaM2', 'perimeterM'],
  angle: ['angleDeg'],
  height: ['heightM'],
  volume: ['lengthM', 'widthM', 'heightM', 'volumeM3'],
  'room-plan': ['areaM2', 'perimeterM', 'segmentsM'],
  photo: ['photo'],
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isLen = (v: unknown): v is number => isNum(v) && v >= 0
const isPoint = (p: unknown): p is ArPoint => !!p && typeof p === 'object' && isNum((p as ArPoint).x) && isNum((p as ArPoint).y) && isNum((p as ArPoint).z)
const isPoint2D = (p: unknown): p is Point2D => !!p && typeof p === 'object' && isNum((p as Point2D).x) && isNum((p as Point2D).y)
const copyPoints = (v: unknown): ArPoint[] => (Array.isArray(v) ? v.filter(isPoint).map(({ x, y, z }) => ({ x, y, z })) : [])
const isFileUri = (v: unknown): v is string => typeof v === 'string' && /^file:\/\//.test(v)

/** A clean copy of a photo measurement, or null if any part of it is malformed. */
function sanitizePhoto(raw: unknown): PhotoMeasurement | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isLen(r.imageWidth) || !isLen(r.imageHeight)) return null
  if (!Array.isArray(r.card) || r.card.length !== 4 || !r.card.every(isPoint2D)) return null
  if (!Array.isArray(r.lines) || r.lines.length < 1) return null
  const lines: PhotoLine[] = []
  for (const l of r.lines as unknown[]) {
    const line = l as Partial<PhotoLine> | null
    if (!line || typeof line !== 'object' || !isPoint2D(line.a) || !isPoint2D(line.b) || !isLen(line.lengthM)) return null
    lines.push({ a: { x: line.a.x, y: line.a.y }, b: { x: line.b.x, y: line.b.y }, lengthM: line.lengthM })
  }
  return {
    imageWidth: r.imageWidth,
    imageHeight: r.imageHeight,
    card: (r.card as Point2D[]).map(({ x, y }) => ({ x, y })),
    lines,
  }
}

/** Keep only well-formed items (with every field their mode needs); anything else is dropped rather than crashing the app. */
function sanitize(raw: unknown): HistoryItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id) return null
  if (typeof r.mode !== 'string' || !MODES.includes(r.mode)) return null
  if (typeof r.createdAt !== 'string' || Number.isNaN(Date.parse(r.createdAt))) return null
  const mode = r.mode as ArMode
  const item: HistoryItem = {
    id: r.id,
    mode,
    unit: isLengthUnit(r.unit) ? r.unit : 'cm',
    createdAt: r.createdAt,
    points: copyPoints(r.points),
  }
  for (const f of NUMBER_FIELDS) if (isLen(r[f])) item[f] = r[f]
  if (item.angleDeg !== undefined && item.angleDeg > 180) delete item.angleDeg
  if (Array.isArray(r.segmentsM) && r.segmentsM.every(isLen)) item.segmentsM = [...r.segmentsM]
  if (mode === 'photo') {
    const photo = sanitizePhoto(r.photo)
    if (!photo) return null
    item.photo = photo
    item.distanceM = photo.lines[0].lengthM
    item.points = []
  }
  if (isFileUri(r.screenshotUri)) item.screenshotUri = r.screenshotUri
  if (typeof r.note === 'string' && r.note) item.note = r.note
  return REQUIRED[mode].every((f) => item[f] !== undefined) ? item : null
}

const newestFirst = (a: HistoryItem, b: HistoryItem) => Date.parse(b.createdAt) - Date.parse(a.createdAt)

/**
 * Read the stored history. Version 1 (distance only) is read as is and saved as version 2 at the
 * next change. Corrupt data or an unknown version gives an empty list.
 */
export function loadHistory(): HistoryItem[] {
  const file = storage.get<unknown>(HISTORY_KEY, null)
  if (!file || typeof file !== 'object') return []
  const { version, items } = file as { version?: unknown; items?: unknown }
  if ((version !== 1 && version !== HISTORY_VERSION) || !Array.isArray(items)) return []
  return items.map(sanitize).filter((i): i is HistoryItem => i !== null).sort(newestFirst)
}

export const historyStore = createStore<HistoryItem[]>(loadHistory())

function commit(items: HistoryItem[]): void {
  const sorted = [...items].sort(newestFirst)
  const file: HistoryFile = { version: HISTORY_VERSION, items: sorted }
  storage.set(HISTORY_KEY, file)
  historyStore.set(sorted)
}

/** Every saved measurement, newest first. */
export const listHistory = (): HistoryItem[] => historyStore.get()
export const getHistoryItem = (id: string): HistoryItem | undefined => historyStore.get().find((i) => i.id === id)

function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

/** Save a finished AR measurement (any AR mode) and return the stored item. Check it with isArMeasurement first. */
export function addFromArResult(r: ArMeasurement): HistoryItem {
  const created = Date.parse(r.createdAt)
  const rec = r as unknown as Record<string, unknown>
  const item: HistoryItem = {
    id: newId(),
    mode: r.mode,
    unit: isLengthUnit(r.unit) ? r.unit : 'cm',
    createdAt: Number.isNaN(created) ? new Date().toISOString() : new Date(created).toISOString(),
    points: copyPoints(r.points),
  }
  for (const f of NUMBER_FIELDS) if (isLen(rec[f])) item[f] = rec[f]
  if (Array.isArray(rec.segmentsM) && rec.segmentsM.every(isLen)) item.segmentsM = [...rec.segmentsM]
  if (r.screenshot?.uri) item.screenshotUri = r.screenshot.uri
  commit([item, ...historyStore.get()])
  return item
}

/** Save a photo measurement (no AR) and return the stored item. Throws if the photo has no valid line. */
export function addPhotoMeasurement(input: { unit: LengthUnit; photo: PhotoMeasurement; screenshotUri?: string }): HistoryItem {
  const photo = sanitizePhoto(input.photo)
  if (!photo) throw new Error('A photo measurement needs the card corners and at least one line.')
  const item: HistoryItem = {
    id: newId(),
    mode: 'photo',
    unit: isLengthUnit(input.unit) ? input.unit : 'cm',
    createdAt: new Date().toISOString(),
    points: [],
    distanceM: photo.lines[0].lengthM,
    photo,
  }
  if (isFileUri(input.screenshotUri)) item.screenshotUri = input.screenshotUri
  commit([item, ...historyStore.get()])
  return item
}

/** Delete the photo file that belongs to a measurement (app only). Never throws. */
async function deleteScreenshot(uri: string | undefined): Promise<void> {
  if (!uri || !Capacitor.isNativePlatform()) return
  try {
    const { Filesystem } = await import('@capacitor/filesystem')
    await Filesystem.deleteFile({ path: uri })
  } catch {
    /* already gone, or not ours to delete */
  }
}

export async function removeHistoryItem(id: string): Promise<void> {
  const item = getHistoryItem(id)
  if (!item) return
  commit(historyStore.get().filter((i) => i.id !== id))
  await deleteScreenshot(item.screenshotUri)
}

export async function clearHistory(): Promise<void> {
  const items = historyStore.get()
  commit([])
  await Promise.all(items.map((i) => deleteScreenshot(i.screenshotUri)))
}

/** Add, change or remove (empty text) the note on a measurement. */
export function setHistoryNote(id: string, note: string): void {
  const text = note.slice(0, 500)
  commit(
    historyStore.get().map((i) => {
      if (i.id !== id) return i
      const next = { ...i }
      if (text.trim()) next.note = text
      else delete next.note
      return next
    }),
  )
}

// ---------------------------------------------------------------- Export

/** One CSV cell: quoted when needed, and never read as a formula by spreadsheet apps. */
export function csvCell(value: string | number | undefined): string {
  let s = value === undefined ? '' : String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const CSV_HEADER = [
  'Date',
  'Mode',
  'Length (m)',
  'Result',
  'Unit',
  'Area (m²)',
  'Perimeter (m)',
  'Angle (°)',
  'Height (m)',
  'Width (m)',
  'Volume (m³)',
  'Wall height (m)',
  'Segments (m)',
  'Note',
  'Photo',
]

const num = (v: number | undefined) => (v === undefined ? undefined : Number(v.toFixed(4)))

function segmentsCell(i: HistoryItem): string | undefined {
  const parts = i.segmentsM ?? i.photo?.lines.map((l) => l.lengthM)
  return parts?.length ? parts.map((m) => m.toFixed(4)).join('; ') : undefined
}

/** "Length (m)" only for modes whose main value is a length; the other modes have their own columns. */
function lengthCell(i: HistoryItem): number | undefined {
  if (i.mode === 'volume') return num(i.lengthM)
  if (i.mode === 'height') return num(i.heightM)
  if (i.mode === 'distance' || i.mode === 'path' || i.mode === 'photo') return num(i.distanceM)
  return undefined
}

/** One row per measurement: raw values in metres (4 decimals) plus the main value as the user saw it. */
export function historyToCsv(items: HistoryItem[]): string {
  const rows = items.map((i) => [
    i.createdAt,
    i.mode,
    lengthCell(i),
    resultSummary(i, i.unit).main,
    i.unit,
    num(i.areaM2),
    num(i.perimeterM),
    num(i.angleDeg),
    num(i.heightM),
    num(i.widthM),
    num(i.volumeM3),
    num(i.wallHeightM),
    segmentsCell(i),
    i.note,
    i.screenshotUri ? 'yes' : 'no',
  ])
  return [CSV_HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function historyToJson(items: HistoryItem[], now = new Date()): string {
  return JSON.stringify({ app: 'Measure Sama', version: HISTORY_VERSION, exportedAt: now.toISOString(), items }, null, 2)
}

const stamp = (d = new Date()) => d.toISOString().slice(0, 10)

/** Save the history as a CSV file (download in the browser, Documents › Measure Sama in the app). */
export function exportCsv(): Promise<SaveResult> {
  return downloadText(historyToCsv(listHistory()), `measure-sama-${stamp()}.csv`, 'text/csv')
}

export function exportJson(): Promise<SaveResult> {
  return downloadText(historyToJson(listHistory()), `measure-sama-${stamp()}.json`, 'application/json')
}
