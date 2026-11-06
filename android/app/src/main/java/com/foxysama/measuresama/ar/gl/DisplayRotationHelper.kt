package com.foxysama.measuresama.ar.gl

import android.app.Activity
import android.hardware.display.DisplayManager
import android.os.Build
import android.view.Display
import com.google.ar.core.Session

/**
 * Keeps ARCore's display geometry (rotation and view size) in sync with the screen.
 * onResume / onPause / onSurfaceChanged may be called from any thread; [updateSessionIfNeeded]
 * runs on the GL thread before Session.update().
 */
class DisplayRotationHelper(private val activity: Activity) : DisplayManager.DisplayListener {
    private val displayManager = activity.getSystemService(DisplayManager::class.java)

    @Volatile private var changed = true

    @Volatile private var width = 0

    @Volatile private var height = 0

    fun onResume() {
        displayManager?.registerDisplayListener(this, null)
        changed = true
    }

    fun onPause() {
        displayManager?.unregisterDisplayListener(this)
    }

    fun onSurfaceChanged(newWidth: Int, newHeight: Int) {
        width = newWidth
        height = newHeight
        changed = true
    }

    /** Tells ARCore about a new rotation or size, if anything changed. GL thread. */
    fun updateSessionIfNeeded(session: Session) {
        if (!changed || width <= 0 || height <= 0) return
        changed = false
        session.setDisplayGeometry(currentDisplay()?.rotation ?: 0, width, height)
    }

    private fun currentDisplay(): Display? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activity.display
        } else {
            @Suppress("DEPRECATION")
            activity.windowManager.defaultDisplay
        }

    override fun onDisplayAdded(displayId: Int) = Unit

    override fun onDisplayRemoved(displayId: Int) = Unit

    override fun onDisplayChanged(displayId: Int) {
        changed = true
    }
}
