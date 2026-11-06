import { Capacitor, registerPlugin } from '@capacitor/core'
import type { AndroidMetrics } from '../modes/screen-ruler/screen-ruler'

interface ScreenMetricsPlugin {
  getMetrics(): Promise<AndroidMetrics>
}

/** App-local plugin: android/app/src/main/java/com/foxysama/measuresama/ScreenMetricsPlugin.java */
const ScreenMetrics = registerPlugin<ScreenMetricsPlugin>('ScreenMetrics')

/** The display's own density report — only inside the Android app; null everywhere else. */
export async function readAndroidMetrics(): Promise<AndroidMetrics | null> {
  // Only call where the plugin exists: rejected plugin calls are logged as console errors.
  if (Capacitor.getPlatform() !== 'android' || !Capacitor.isPluginAvailable('ScreenMetrics')) return null
  try {
    return await ScreenMetrics.getMetrics()
  } catch {
    return null
  }
}

/** Chrome on Android hides the phone model from the user agent but can share it on request. */
export async function readDeviceModel(): Promise<string | null> {
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean; getHighEntropyValues?: (h: string[]) => Promise<{ model?: string }> } }).userAgentData
  if (!uaData?.getHighEntropyValues) return null
  try {
    const { model } = await uaData.getHighEntropyValues(['model'])
    return model?.trim() || null
  } catch {
    return null
  }
}
