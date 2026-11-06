import { CapacitorException, WebPlugin, type ExceptionCode } from '@capacitor/core'
import type { ArAvailability, ArAvailabilityStatus, ArMeasureErrorCode, ArMeasurePlugin, ArStartOptions, ArStartResult } from './definitions'

export const WEB_UNSUPPORTED_REASON = 'AR measuring works in the Measure Sama app on phones that support AR.'
export const COMING_SOON_MESSAGE = 'This measuring mode is coming soon.'

/** Browsers can't measure with the camera: every call reports "unsupported". */
export class ArMeasureWeb extends WebPlugin implements ArMeasurePlugin {
  async checkAvailability(): Promise<ArAvailability> {
    return { status: 'unsupported', platform: 'web', reason: WEB_UNSUPPORTED_REASON }
  }

  async requestInstall(): Promise<{ status: ArAvailabilityStatus }> {
    return { status: 'unsupported' }
  }

  async start(options: ArStartOptions): Promise<ArStartResult> {
    if (options?.mode !== 'distance') {
      const code: ArMeasureErrorCode = 'NOT_IMPLEMENTED'
      throw new CapacitorException(COMING_SOON_MESSAGE, code as ExceptionCode)
    }
    throw this.unavailable(WEB_UNSUPPORTED_REASON)
  }
}
