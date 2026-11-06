package com.foxysama.measuresama.ar

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import com.foxysama.measuresama.R
import com.google.ar.core.ArCoreApk
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Asks ARCore whether this phone can run AR, and maps the answer to the plugin's
 * ArAvailabilityStatus strings. Never throws, never waits longer than [TIMEOUT_MS].
 */
object ArAvailability {
    const val SUPPORTED = "supported"
    const val NEEDS_INSTALL = "needs-install"
    const val NEEDS_UPDATE = "needs-update"
    const val UNSUPPORTED = "unsupported"
    const val UNKNOWN = "unknown"

    const val TIMEOUT_MS = 10_000L
    private const val POLL_MS = 250L
    private const val TAG = "ArAvailability"

    fun statusOf(availability: ArCoreApk.Availability): String =
        when (availability) {
            ArCoreApk.Availability.SUPPORTED_INSTALLED -> SUPPORTED
            ArCoreApk.Availability.SUPPORTED_NOT_INSTALLED -> NEEDS_INSTALL
            ArCoreApk.Availability.SUPPORTED_APK_TOO_OLD -> NEEDS_UPDATE
            ArCoreApk.Availability.UNSUPPORTED_DEVICE_NOT_CAPABLE -> UNSUPPORTED
            else -> UNKNOWN
        }

    /** A plain-language sentence for the user that explains [status]. */
    fun reasonFor(context: Context, status: String): String =
        context.getString(
            when (status) {
                SUPPORTED -> R.string.ar_reason_supported
                NEEDS_INSTALL -> R.string.ar_reason_needs_install
                NEEDS_UPDATE -> R.string.ar_reason_needs_update
                UNSUPPORTED -> R.string.ar_reason_unsupported
                else -> R.string.ar_reason_unknown
            },
        )

    /**
     * Checks availability and calls [onResult] exactly once, on the main thread, with a status
     * string. UNKNOWN_CHECKING is polled until it settles; after [TIMEOUT_MS] the result is
     * [UNKNOWN].
     */
    fun check(context: Context, onResult: (String) -> Unit) {
        val appContext = context.applicationContext
        val main = Handler(Looper.getMainLooper())
        val done = AtomicBoolean(false)
        val deadline = SystemClock.elapsedRealtime() + TIMEOUT_MS

        fun finish(status: String) {
            if (done.compareAndSet(false, true)) onResult(status)
        }

        val timeout = Runnable { finish(UNKNOWN) }
        main.postDelayed(timeout, TIMEOUT_MS)

        fun attempt() {
            if (done.get()) return
            try {
                ArCoreApk.getInstance().checkAvailabilityAsync(appContext) { availability ->
                    if (availability == ArCoreApk.Availability.UNKNOWN_CHECKING) {
                        // Still checking: ask again shortly. The timeout settles it if it never ends.
                        if (SystemClock.elapsedRealtime() + POLL_MS < deadline) {
                            main.postDelayed({ attempt() }, POLL_MS)
                        }
                    } else {
                        main.removeCallbacks(timeout)
                        // Deliver on the main thread, whichever thread ARCore called back on.
                        main.post { finish(statusOf(availability)) }
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "ARCore availability check failed", e)
                main.removeCallbacks(timeout)
                main.post { finish(UNKNOWN) }
            }
        }

        main.post { attempt() }
    }
}
