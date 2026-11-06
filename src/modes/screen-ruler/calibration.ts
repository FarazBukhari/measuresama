import { STORAGE_PREFIX, storage } from '../../lib/storage'
import { createStore } from '../../state/createStore'
import { readScreen, screenKey, type Calibration, type CalibrationSource } from './screen-ruler'

/** Saved scales, one per screen setup (screenKey), so another monitor or zoom level starts fresh. */
export const CALIBRATIONS_KEY = `${STORAGE_PREFIX}screen-ruler:calibrations`

const SOURCES: readonly CalibrationSource[] = ['android-display', 'device-specs', 'screen-size', 'card', 'estimate']

function load(): Record<string, Calibration> {
  const raw = storage.get<unknown>(CALIBRATIONS_KEY, {})
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, Calibration> = {}
  for (const [key, c] of Object.entries(raw as Record<string, Partial<Calibration>>)) {
    if (c && typeof c.pxPerMm === 'number' && Number.isFinite(c.pxPerMm) && c.pxPerMm > 0 && SOURCES.includes(c.source as CalibrationSource)) {
      out[key] = { ...(c as Calibration), confirmed: c.confirmed === true }
    }
  }
  return out
}

export const calibrationsStore = createStore<Record<string, Calibration>>(load())

function commit(next: Record<string, Calibration>): void {
  storage.set(CALIBRATIONS_KEY, next)
  calibrationsStore.set(next)
}

export function saveCalibration(key: string, c: Calibration): void {
  commit({ ...calibrationsStore.get(), [key]: c })
}

export function forgetCalibration(key: string): void {
  const next = { ...calibrationsStore.get() }
  delete next[key]
  commit(next)
}

/** "Recalibrate" in Settings: forget this screen's scale so the ruler asks for a card check again. */
export function forgetThisScreen(): void {
  forgetCalibration(screenKey(readScreen()))
}
