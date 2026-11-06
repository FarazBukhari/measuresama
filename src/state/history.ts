import { Capacitor } from '@capacitor/core'
import { downloadText, type SaveResult } from '../lib/download'
import { STORAGE_PREFIX, storage } from '../lib/storage'
import { formatLength, isLengthUnit, type LengthUnit } from '../lib/units'
import type { ArMeasurement, ArMode, ArPoint } from '../plugins/ar-measure/definitions'
import { createStore } from './createStore'

/**
 * Saved measurements, stored on this device only. Lengths are always metres (never display
 * strings) and photos stay as files: only their file:// URI is stored here, never image data.
 */

export const HISTORY_KEY = `${STORAGE_PREFIX}history`
export const HISTORY_VERSION = 1

export interface HistoryItem {
  id: string
  mode: ArMode
  distanceM: number
  areaM2?: number
  points: ArPoint[]
  /** Unit the user saw while measuring. */
  unit: LengthUnit
  /** file:// URI of the photo in app-private storage. */
  screenshotUri?: string
  /** ISO 8601 UTC. */
  createdAt: string
  note?: string
}

export interface HistoryFile {
  version: typeof HISTORY_VERSION
  items: HistoryItem[]
}

const MODES: readonly string[] = ['distance', 'path', 'area', 'angle', 'height', 'volume', 'room-plan', 'photo']
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isPoint = (p: unknown): p is ArPoint => !!p && typeof p === 'object' && isNum((p as ArPoint).x) && isNum((p as ArPoint).y) && isNum((p as ArPoint).z)

/** Keep only well-formed items; anything else is dropped rather than crashing the app. */
function sanitize(raw: unknown): HistoryItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id) return null
  if (typeof r.mode !== 'string' || !MODES.includes(r.mode)) return null
  if (!isNum(r.distanceM) || r.distanceM < 0) return null
  if (typeof r.createdAt !== 'string' || Number.isNaN(Date.parse(r.createdAt))) return null
  const item: HistoryItem = {
    id: r.id,
    mode: r.mode as ArMode,
    distanceM: r.distanceM,
    points: Array.isArray(r.points) ? r.points.filter(isPoint).map(({ x, y, z }) => ({ x, y, z })) : [],
    unit: isLengthUnit(r.unit) ? r.unit : 'cm',
    createdAt: r.createdAt,
  }
  if (isNum(r.areaM2)) item.areaM2 = r.areaM2
  if (typeof r.screenshotUri === 'string' && /^file:\/\//.test(r.screenshotUri)) item.screenshotUri = r.screenshotUri
  if (typeof r.note === 'string' && r.note) item.note = r.note
  return item
}

const newestFirst = (a: HistoryItem, b: HistoryItem) => Date.parse(b.createdAt) - Date.parse(a.createdAt)

/** Read the stored history. Corrupt data or an unknown version gives an empty list. */
export function loadHistory(): HistoryItem[] {
  const file = storage.get<unknown>(HISTORY_KEY, null)
  if (!file || typeof file !== 'object') return []
  const { version, items } = file as Partial<HistoryFile>
  if (version !== HISTORY_VERSION || !Array.isArray(items)) return []
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

/** Save a finished AR measurement and return the stored item. */
export function addFromArResult(r: ArMeasurement): HistoryItem {
  const created = Date.parse(r.createdAt)
  const item: HistoryItem = {
    id: newId(),
    mode: r.mode,
    distanceM: r.distanceM,
    points: (r.points ?? []).filter(isPoint).map(({ x, y, z }) => ({ x, y, z })),
    unit: isLengthUnit(r.unit) ? r.unit : 'cm',
    createdAt: Number.isNaN(created) ? new Date().toISOString() : new Date(created).toISOString(),
  }
  if (isNum(r.areaM2)) item.areaM2 = r.areaM2
  if (r.screenshot?.uri) item.screenshotUri = r.screenshot.uri
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

const CSV_HEADER = ['Date', 'Mode', 'Length (m)', 'Length', 'Unit', 'Area (m²)', 'Note', 'Photo']

export function historyToCsv(items: HistoryItem[]): string {
  const rows = items.map((i) =>
    [i.createdAt, i.mode, Number(i.distanceM.toFixed(4)), formatLength(i.distanceM, i.unit), i.unit, i.areaM2 === undefined ? undefined : Number(i.areaM2.toFixed(4)), i.note, i.screenshotUri ? 'yes' : 'no'],
  )
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
