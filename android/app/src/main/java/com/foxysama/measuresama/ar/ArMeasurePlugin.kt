package com.foxysama.measuresama.ar

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.util.Log
import androidx.activity.result.ActivityResult
import com.foxysama.measuresama.R
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.ar.core.ArCoreApk
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONException

private const val CAMERA_ALIAS = "camera"

/**
 * ArMeasure: AR tape measure (jsName 'ArMeasure'). Matches src/plugins/ar-measure/ exactly.
 *
 * - checkAvailability / requestInstall never reject.
 * - start resolves ArMeasurement or ArCancelled. Expected outcomes (user closed the screen, camera
 *   permission denied, AR failed to start) resolve as { cancelled: true } and never reject, because
 *   rejected calls log console errors. It rejects only for NOT_IMPLEMENTED, UNAVAILABLE, BUSY,
 *   INVALID_ARGUMENT and INTERNAL.
 */
@CapacitorPlugin(
    name = "ArMeasure",
    permissions = [Permission(alias = CAMERA_ALIAS, strings = [Manifest.permission.CAMERA])],
)
class ArMeasurePlugin : Plugin() {
    /** True from start() until its result is delivered: only one AR screen at a time. */
    private val arOpen = AtomicBoolean(false)

    /** requestInstall calls waiting for the user to return from ARCore's install screen. Main thread only. */
    private val pendingInstallCalls = mutableListOf<PluginCall>()

    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        ArAvailability.check(context) { status -> call.resolve(availabilityResult(status)) }
    }

    @PluginMethod
    fun requestInstall(call: PluginCall) {
        activity.runOnUiThread { requestInstallOnMain(call) }
    }

    private fun requestInstallOnMain(call: PluginCall) {
        if (pendingInstallCalls.isNotEmpty()) {
            // An install prompt is already showing; answer this call when it ends too.
            pendingInstallCalls.add(call)
            return
        }
        try {
            when (ArCoreApk.getInstance().requestInstall(activity, true)) {
                // ARCore opened its install screen; handleOnResume answers when the user is back.
                ArCoreApk.InstallStatus.INSTALL_REQUESTED -> pendingInstallCalls.add(call)
                else -> resolveFreshStatus(call)
            }
        } catch (e: UnavailableDeviceNotCompatibleException) {
            resolveStatus(call, ArAvailability.UNSUPPORTED)
        } catch (e: UnavailableUserDeclinedInstallationException) {
            resolveFreshStatus(call)
        } catch (e: Exception) {
            Log.w(TAG, "ARCore install request failed", e)
            resolveFreshStatus(call)
        }
    }

    override fun handleOnResume() {
        super.handleOnResume()
        if (pendingInstallCalls.isEmpty()) return
        val calls = pendingInstallCalls.toList()
        pendingInstallCalls.clear()
        ArAvailability.check(context) { status -> calls.forEach { resolveStatus(it, status) } }
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val mode = call.getString("mode")
        val unit = call.getString("unit")
        if (mode == null || mode !in KNOWN_MODES) {
            call.reject("Unknown measuring mode.", INVALID_ARGUMENT)
            return
        }
        if (unit == null || unit !in KNOWN_UNITS) {
            call.reject("Unknown unit. Use \"cm\" or \"in\".", INVALID_ARGUMENT)
            return
        }
        if (mode != MODE_DISTANCE) {
            call.reject("This measuring mode is coming soon.", NOT_IMPLEMENTED)
            return
        }
        if (!arOpen.compareAndSet(false, true)) {
            call.reject("The AR screen is already open.", BUSY)
            return
        }
        try {
            ArAvailability.check(context) { status -> onStartAvailability(call, status) }
        } catch (e: Exception) {
            fail(call, e)
        }
    }

    private fun onStartAvailability(call: PluginCall, status: String) {
        if (status != ArAvailability.SUPPORTED) {
            arOpen.set(false)
            call.reject(ArAvailability.reasonFor(context, status), UNAVAILABLE)
            return
        }
        try {
            if (getPermissionState(CAMERA_ALIAS) == PermissionState.GRANTED) {
                launchAr(call)
            } else {
                requestPermissionForAlias(CAMERA_ALIAS, call, "onCameraPermission")
            }
        } catch (e: Exception) {
            fail(call, e)
        }
    }

    @Suppress("unused") // Called by Capacitor through @PermissionCallback.
    @PermissionCallback
    private fun onCameraPermission(call: PluginCall?) {
        if (call == null) {
            arOpen.set(false)
            return
        }
        if (getPermissionState(CAMERA_ALIAS) == PermissionState.GRANTED) {
            launchAr(call)
        } else {
            arOpen.set(false)
            call.resolve(cancelled(REASON_PERMISSION_DENIED, context.getString(R.string.ar_error_camera_permission)))
            bridge.releaseCall(call)
        }
    }

    private fun launchAr(call: PluginCall) {
        try {
            val intent =
                Intent(context, ArMeasureActivity::class.java)
                    .putExtra(ArMeasureActivity.EXTRA_UNIT, call.getString("unit"))
            startActivityForResult(call, intent, "onArResult")
        } catch (e: Exception) {
            fail(call, e)
        }
    }

    @Suppress("unused") // Called by Capacitor through @ActivityCallback.
    @ActivityCallback
    private fun onArResult(call: PluginCall?, result: ActivityResult) {
        arOpen.set(false)
        if (call == null) return
        val json = result.data?.getStringExtra(ArMeasureActivity.EXTRA_RESULT)
        try {
            when {
                json != null -> call.resolve(JSObject(json))
                result.resultCode == Activity.RESULT_CANCELED -> call.resolve(cancelled(REASON_USER, null))
                else -> call.reject("The AR screen closed without a result.", INTERNAL)
            }
        } catch (e: JSONException) {
            call.reject("The AR screen sent a result we couldn't read.", INTERNAL, e)
        }
        bridge.releaseCall(call)
    }

    private fun fail(call: PluginCall, e: Exception) {
        Log.e(TAG, "Couldn't open the AR screen", e)
        arOpen.set(false)
        call.reject("Couldn't open the AR screen.", INTERNAL, e)
        bridge.releaseCall(call)
    }

    private fun resolveFreshStatus(call: PluginCall) {
        ArAvailability.check(context) { status -> resolveStatus(call, status) }
    }

    private fun resolveStatus(call: PluginCall, status: String) {
        call.resolve(JSObject().put("status", status))
    }

    private fun availabilityResult(status: String): JSObject =
        JSObject()
            .put("status", status)
            .put("platform", "android")
            .put("reason", ArAvailability.reasonFor(context, status))

    private fun cancelled(reason: String, message: String?): JSObject {
        val result = JSObject().put("cancelled", true).put("reason", reason)
        if (message != null) result.put("message", message)
        return result
    }

    companion object {
        private const val TAG = "ArMeasurePlugin"

        const val MODE_DISTANCE = "distance"
        private val KNOWN_MODES =
            setOf("distance", "path", "area", "angle", "height", "volume", "room-plan", "photo")
        private val KNOWN_UNITS = setOf(LengthFormat.UNIT_CM, LengthFormat.UNIT_IN)

        // ArCancelled reasons
        const val REASON_USER = "user"
        const val REASON_PERMISSION_DENIED = "permission-denied"
        const val REASON_AR_UNAVAILABLE = "ar-unavailable"

        // start() rejection codes
        private const val NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
        private const val UNAVAILABLE = "UNAVAILABLE"
        private const val BUSY = "BUSY"
        private const val INVALID_ARGUMENT = "INVALID_ARGUMENT"
        private const val INTERNAL = "INTERNAL"
    }
}
