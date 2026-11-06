/**
 * ArMeasure: the app's own Capacitor plugin (jsName 'ArMeasure').
 * Native implementations must match this contract exactly:
 * Android `ArMeasurePlugin.kt` (ARCore), iOS `ArMeasurePlugin.swift` (ARKit).
 */

export type ArMode = 'distance' | 'path' | 'area' | 'angle' | 'height' | 'volume' | 'room-plan' | 'photo'
export type LengthUnit = 'cm' | 'in'
export type ArAvailabilityStatus = 'supported' | 'needs-install' | 'needs-update' | 'unsupported' | 'unknown'
export interface ArAvailability {
  status: ArAvailabilityStatus
  platform: 'android' | 'ios' | 'web'
  reason?: string   // plain-language sentence for the user, e.g. "This phone can't run AR."
  lidar?: boolean   // iOS only: scene depth / mesh available
}
export interface ArPoint { x: number; y: number; z: number }   // metres, AR world space
export interface ArScreenshot { uri: string; width: number; height: number; mimeType: 'image/jpeg' }
// uri = absolute file:// URI in app-private storage (Android: filesDir/measurements/<id>.jpg; iOS: Library/NoCloud/measurements/<id>.jpg). Display it with Capacitor.convertFileSrc(uri). Share it with @capacitor/share files:[uri].
export interface ArMeasurement {
  cancelled: false
  mode: 'distance'
  unit: LengthUnit        // echo of the unit the user saw
  points: ArPoint[]       // distance: exactly 2 (A, B)
  distanceM: number       // |B - A| in metres
  areaM2?: number         // reserved for future modes
  screenshot?: ArScreenshot
  createdAt: string       // ISO 8601 UTC
}
export interface ArCancelled {
  cancelled: true
  reason: 'user' | 'permission-denied' | 'ar-unavailable' | 'tracking-lost'
  message?: string        // plain language
}
export type ArStartResult = ArMeasurement | ArCancelled
export interface ArStartOptions { mode: ArMode; unit: LengthUnit }
export interface ArMeasurePlugin {
  checkAvailability(): Promise<ArAvailability>                  // NEVER rejects; resolves 'unknown' after a 10 s cap
  requestInstall(): Promise<{ status: ArAvailabilityStatus }>   // NEVER rejects; web/iOS resolve the current status
  start(options: ArStartOptions): Promise<ArStartResult>
}

/**
 * Codes start() rejects with (PluginCall.reject(message, code)). Expected outcomes (back pressed,
 * camera permission denied, AR session failed) resolve as ArCancelled instead.
 */
export type ArMeasureErrorCode = 'NOT_IMPLEMENTED' | 'UNAVAILABLE' | 'BUSY' | 'INVALID_ARGUMENT' | 'INTERNAL'
