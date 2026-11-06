import { Capacitor, registerPlugin } from '@capacitor/core'
import type { ArAvailability, ArAvailabilityStatus, ArMeasureErrorCode, ArMeasurement, ArMeasurePlugin, ArMode, ArPluginMode, ArStartResult } from './definitions'

export * from './definitions'

export const ArMeasure = registerPlugin<ArMeasurePlugin>('ArMeasure', {
  web: () => import('./web').then((m) => new m.ArMeasureWeb()),
})

/** Every mode the native plugin can measure, in catalog order. */
export const AR_PLUGIN_MODES: readonly ArPluginMode[] = ['distance', 'path', 'area', 'angle', 'height', 'volume', 'room-plan']

const isPluginMode = (m: unknown): m is ArPluginMode => typeof m === 'string' && (AR_PLUGIN_MODES as readonly string[]).includes(m)
const isLen = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isLenList = (v: unknown): v is number[] => Array.isArray(v) && v.every(isLen)
const isCoord = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const isPoint = (p: unknown) => !!p && typeof p === 'object' && isCoord((p as Record<string, unknown>).x) && isCoord((p as Record<string, unknown>).y) && isCoord((p as Record<string, unknown>).z)

/** Required fields of each mode (see definitions.ts). */
const REQUIRED: Record<ArPluginMode, (r: Record<string, unknown>) => boolean> = {
  distance: (r) => isLen(r.distanceM),
  path: (r) => isLen(r.distanceM) && isLenList(r.segmentsM),
  area: (r) => isLen(r.areaM2) && isLen(r.perimeterM) && isLenList(r.segmentsM),
  angle: (r) => isLen(r.angleDeg) && (r.angleDeg as number) <= 180 && isLenList(r.segmentsM),
  height: (r) => isLen(r.heightM),
  volume: (r) => isLen(r.lengthM) && isLen(r.widthM) && isLen(r.heightM) && isLen(r.volumeM3) && isLen(r.areaM2),
  'room-plan': (r) => isLen(r.areaM2) && isLen(r.perimeterM) && isLenList(r.segmentsM) && (r.wallHeightM === undefined || isLen(r.wallHeightM)),
}

/** A finished measurement with every field its mode needs (finite, not negative) and well-formed points. */
export function isArMeasurement(r: ArStartResult | null | undefined): r is ArMeasurement {
  if (!r || typeof r !== 'object' || r.cancelled !== false) return false
  const rec = r as unknown as Record<string, unknown>
  if (!isPluginMode(rec.mode) || !Array.isArray(rec.points) || !rec.points.every(isPoint)) return false
  return REQUIRED[rec.mode](rec)
}

/** AR modes start() may be called with: none unless AR is supported; older builds only know distance. */
export function availableArModes(a: ArAvailability | null | undefined): ArMode[] {
  if (a?.status !== 'supported') return []
  return Array.isArray(a.modes) ? a.modes.filter(isPluginMode) : ['distance']
}

export function canStartMode(a: ArAvailability | null | undefined, mode: ArMode): boolean {
  return availableArModes(a).includes(mode)
}

export const NO_PLUGIN_REASON = 'Measuring with the camera isn’t available in this version of the app.'

function nativePlatform(): 'android' | 'ios' {
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
}

/** In the app, but this build has no ArMeasure plugin: calling it would reject and log an error. */
function pluginMissing(): boolean {
  return Capacitor.isNativePlatform() && !Capacitor.isPluginAvailable('ArMeasure')
}

/** The native side caps its own check at 10 s; this is a safety net in case it never answers. */
const CHECK_TIMEOUT_MS = 12_000

/** checkAvailability() that never rejects and never calls a plugin that isn't there. */
export async function checkArAvailability(): Promise<ArAvailability> {
  if (pluginMissing()) return { status: 'unsupported', platform: nativePlatform(), reason: NO_PLUGIN_REASON }
  const platform = Capacitor.isNativePlatform() ? nativePlatform() : 'web'
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<ArAvailability>((resolve) => {
    timer = setTimeout(() => resolve({ status: 'unknown', platform }), CHECK_TIMEOUT_MS)
  })
  try {
    return await Promise.race([ArMeasure.checkAvailability(), timeout])
  } catch {
    return { status: 'unknown', platform }
  } finally {
    clearTimeout(timer)
  }
}

/** requestInstall() with the same guard. Resolves the status to show next. */
export async function requestArInstall(): Promise<ArAvailabilityStatus> {
  if (pluginMissing()) return 'unsupported'
  try {
    return (await ArMeasure.requestInstall()).status
  } catch {
    return 'unknown'
  }
}

/** The error code of a rejected start() call, if it carries one of ours. */
export function arErrorCode(e: unknown): ArMeasureErrorCode | undefined {
  const code = (e as { code?: unknown } | null)?.code
  return code === 'NOT_IMPLEMENTED' || code === 'UNAVAILABLE' || code === 'BUSY' || code === 'INVALID_ARGUMENT' || code === 'INTERNAL' ? code : undefined
}
