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
  modes?: ArMode[]  // AR modes start() can run (Android: all but 'photo'; iOS: distance; web: none). Missing = ['distance'].
}
/** Modes the native plugin measures. 'photo' is web-only and never sent to start(). */
export type ArPluginMode = Exclude<ArMode, 'photo'>
export interface ArPoint { x: number; y: number; z: number }   // metres, AR world space
export interface ArScreenshot { uri: string; width: number; height: number; mimeType: 'image/jpeg' }
// uri = absolute file:// URI in app-private storage (Android: filesDir/measurements/<id>.jpg; iOS: Library/NoCloud/measurements/<id>.jpg). Display it with Capacitor.convertFileSrc(uri). Share it with @capacitor/share files:[uri].
/**
 * A finished measurement. Lengths in metres, areas in m², volumes in m³, angles in degrees.
 * Native rounds numbers to 5 decimals (angleDeg to 3).
 */
interface ArMeasurementBase<M extends ArPluginMode> {
  cancelled: false
  mode: M
  unit: LengthUnit        // echo of the unit the user saw
  points: ArPoint[]
  screenshot?: ArScreenshot
  createdAt: string       // ISO 8601 UTC
}
/** points [A, B]. */
export interface ArDistanceMeasurement extends ArMeasurementBase<'distance'> {
  distanceM: number       // |B - A|
}
/** points [P1..Pn], n >= 2. */
export interface ArPathMeasurement extends ArMeasurementBase<'path'> {
  segmentsM: number[]     // n - 1 parts
  distanceM: number       // sum(segmentsM)
}
/** points [P1..Pn], n >= 3, on one plane. */
export interface ArAreaMeasurement extends ArMeasurementBase<'area'> {
  segmentsM: number[]     // n sides, the last is Pn -> P1
  perimeterM: number
  areaM2: number          // shoelace in the plane's 2D basis
  distanceM: number       // = perimeterM
}
/** points [A, V, B], V = the corner. */
export interface ArAngleMeasurement extends ArMeasurementBase<'angle'> {
  angleDeg: number        // 0..180
  segmentsM: number[]     // [|A - V|, |B - V|]
}
/** points [base, top], top straight above base. */
export interface ArHeightMeasurement extends ArMeasurementBase<'height'> {
  heightM: number
  distanceM: number       // = heightM
}
/** points [A, B, C, T]: A, B, C on the floor (BC square to AB), T straight above C. */
export interface ArVolumeMeasurement extends ArMeasurementBase<'volume'> {
  lengthM: number         // |AB|
  widthM: number          // |BC|
  heightM: number         // |T - C|
  areaM2: number          // lengthM * widthM
  volumeM3: number        // lengthM * widthM * heightM
}
/** points [C1..Cn], n >= 3 floor corners. */
export interface ArRoomPlanMeasurement extends ArMeasurementBase<'room-plan'> {
  segmentsM: number[]     // n walls, the last closes the room
  perimeterM: number
  areaM2: number
  wallHeightM?: number    // only if measured
  distanceM: number       // = perimeterM
}
export type ArMeasurement =
  | ArDistanceMeasurement
  | ArPathMeasurement
  | ArAreaMeasurement
  | ArAngleMeasurement
  | ArHeightMeasurement
  | ArVolumeMeasurement
  | ArRoomPlanMeasurement
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
