import { Capacitor, registerPlugin } from '@capacitor/core'
import type { ArAvailability, ArAvailabilityStatus, ArMeasureErrorCode, ArMeasurement, ArMeasurePlugin, ArStartResult } from './definitions'

export * from './definitions'

export const ArMeasure = registerPlugin<ArMeasurePlugin>('ArMeasure', {
  web: () => import('./web').then((m) => new m.ArMeasureWeb()),
})

export function isArMeasurement(r: ArStartResult | null | undefined): r is ArMeasurement {
  return !!r && r.cancelled === false && Number.isFinite(r.distanceM)
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
