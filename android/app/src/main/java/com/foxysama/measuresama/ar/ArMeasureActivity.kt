package com.foxysama.measuresama.ar

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.HapticFeedbackConstants
import android.view.PixelCopy
import android.view.View
import android.widget.Button
import android.widget.ImageButton
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.graphics.createBitmap
import androidx.core.graphics.scale
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.foxysama.measuresama.R
import com.foxysama.measuresama.ar.gl.CameraBackgroundRenderer
import com.foxysama.measuresama.ar.gl.DisplayRotationHelper
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Session
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.google.ar.core.exceptions.SessionPausedException
import com.google.ar.core.exceptions.UnavailableApkTooOldException
import com.google.ar.core.exceptions.UnavailableArcoreNotInstalledException
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException
import com.google.ar.core.exceptions.UnavailableSdkTooOldException
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.max
import kotlin.math.roundToInt
import org.json.JSONArray
import org.json.JSONObject

/**
 * AR distance screen, opened by [ArMeasurePlugin.start]. Returns one JSON result (an ArMeasurement
 * or an ArCancelled) in [EXTRA_RESULT].
 *
 * THREADING MODEL
 * - GL thread (GLSurfaceView renderer, [onDrawFrame]) is the only thread that touches ARCore
 *   frame data: Session.update(), hit tests, anchor creation/detach and all matrix math, through
 *   [MeasureSession].
 * - Main thread handles taps. The '+' button, a tap on the camera view, Undo, Clear and Save only
 *   add a [Command] to [commands] (a ConcurrentLinkedQueue); the GL thread drains it at the start
 *   of each frame.
 * - Each frame the GL thread builds an immutable [OverlayState] (projected points, line, label and
 *   its position, reticle and its state, hint, distance warning), publishes it to
 *   [MeasureOverlayView] through an AtomicReference and calls postInvalidate(). The overlay only
 *   reads the latest snapshot.
 * - Results go back to the main thread with runOnUiThread (hint text, buttons, haptics, Save).
 * - Session lifecycle (create, configure, resume, pause, close) runs on the main thread, ordered so
 *   it never overlaps a frame: onResume resumes the session before the GL thread; onPause pauses
 *   the GL thread (GLSurfaceView.onPause blocks until it stops) before the session; onDestroy
 *   detaches anchors and closes the session while the GL thread is paused.
 */
class ArMeasureActivity : AppCompatActivity(), GLSurfaceView.Renderer, MeasureSession.Listener {
    private lateinit var glView: GLSurfaceView
    private lateinit var overlay: MeasureOverlayView
    private lateinit var hintText: TextView
    private lateinit var warningText: TextView
    private lateinit var undoButton: Button
    private lateinit var clearButton: Button
    private lateinit var saveButton: Button
    private lateinit var addButton: ImageButton

    private lateinit var displayRotationHelper: DisplayRotationHelper
    private lateinit var measure: MeasureSession
    private val background = CameraBackgroundRenderer()
    private val commands = ConcurrentLinkedQueue<Command>()

    /** Created and closed on the main thread; read by the GL thread while it is running. */
    @Volatile private var session: Session? = null
    private var installRequested = false
    private var glResumed = false

    // GL thread only.
    private var cameraTextureSet = false
    private var viewWidth = 0
    private var viewHeight = 0
    @Volatile private var lastUi: UiSnapshot? = null

    /** Set once a result has been sent, so the screen finishes only once. */
    private val resultSent = AtomicBoolean(false)

    /** Main thread only. */
    private var saving = false
    private var unit = LengthFormat.UNIT_CM

    /** The parts of [OverlayState] shown by regular views; posted to the main thread on change. */
    private data class UiSnapshot(
        val hint: String?,
        val warning: String?,
        val pointCount: Int,
        val planeLocked: Boolean,
    )

    private data class Screenshot(val uri: String, val width: Int, val height: Int)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Camera fills the screen; light system-bar icons over it.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        setContentView(R.layout.activity_ar_measure)

        unit = if (intent.getStringExtra(EXTRA_UNIT) == LengthFormat.UNIT_IN) LengthFormat.UNIT_IN else LengthFormat.UNIT_CM
        measure = MeasureSession(unit, hintTexts(), this)
        displayRotationHelper = DisplayRotationHelper(this)

        glView = findViewById(R.id.ar_gl_view)
        overlay = findViewById(R.id.ar_overlay)
        hintText = findViewById(R.id.ar_hint)
        warningText = findViewById(R.id.ar_warning)
        undoButton = findViewById(R.id.ar_undo)
        clearButton = findViewById(R.id.ar_clear)
        saveButton = findViewById(R.id.ar_save)
        addButton = findViewById(R.id.ar_add)

        glView.preserveEGLContextOnPause = true
        glView.setEGLContextClientVersion(2)
        glView.setEGLConfigChooser(8, 8, 8, 8, 16, 0)
        glView.setRenderer(this)
        glView.renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY

        overlay.setOnClickListener { queue(Command.ADD_POINT) }
        addButton.setOnClickListener { queue(Command.ADD_POINT) }
        undoButton.setOnClickListener { queue(Command.UNDO) }
        clearButton.setOnClickListener { queue(Command.CLEAR) }
        saveButton.setOnClickListener { onSaveClicked() }
        findViewById<View>(R.id.ar_close).setOnClickListener { finishCancelled(ArMeasurePlugin.REASON_USER, null) }
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    finishCancelled(ArMeasurePlugin.REASON_USER, null)
                }
            },
        )

        applySystemBarInsets()
        applyUi(UiSnapshot(getString(R.string.ar_hint_getting_ready), null, 0, false))
    }

    override fun onResume() {
        super.onResume()
        if (resultSent.get()) return

        if (session == null) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                finishCancelled(ArMeasurePlugin.REASON_PERMISSION_DENIED, getString(R.string.ar_error_camera_permission))
                return
            }
            try {
                // The plugin only opens this screen when ARCore is installed; this covers the rest.
                when (ArCoreApk.getInstance().requestInstall(this, !installRequested)) {
                    ArCoreApk.InstallStatus.INSTALL_REQUESTED -> {
                        installRequested = true
                        return
                    }
                    else -> Unit
                }
                val created = Session(this)
                created.configure(sessionConfig(created))
                session = created
            } catch (e: Exception) {
                Log.w(TAG, "AR session could not be created", e)
                finishCancelled(ArMeasurePlugin.REASON_AR_UNAVAILABLE, unavailableMessage(e))
                return
            }
        }

        try {
            session?.resume()
        } catch (e: CameraNotAvailableException) {
            Log.w(TAG, "Camera not available", e)
            session?.close()
            session = null
            finishCancelled(ArMeasurePlugin.REASON_AR_UNAVAILABLE, unavailableMessage(e))
            return
        } catch (e: Exception) {
            Log.w(TAG, "AR session could not resume", e)
            session?.close()
            session = null
            finishCancelled(ArMeasurePlugin.REASON_AR_UNAVAILABLE, unavailableMessage(e))
            return
        }
        glView.onResume()
        glResumed = true
        displayRotationHelper.onResume()
    }

    override fun onPause() {
        super.onPause()
        displayRotationHelper.onPause()
        if (glResumed) {
            // Blocks until the GL thread has stopped drawing, so no frame overlaps session.pause().
            glView.onPause()
            glResumed = false
        }
        session?.pause()
    }

    override fun onDestroy() {
        // The GL thread is paused (onPause ran), so ARCore objects can be released here.
        session?.let {
            measure.detachAll()
            it.close()
        }
        session = null
        super.onDestroy()
    }

    // ---- GL thread ----------------------------------------------------------------------------

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        GLES20.glClearColor(0f, 0f, 0f, 1f)
        try {
            background.createOnGlThread()
            // A new GL context means a new texture: hand it to ARCore again.
            cameraTextureSet = false
        } catch (e: Exception) {
            Log.e(TAG, "Camera renderer failed", e)
            runOnUiThread { finishCancelled(ArMeasurePlugin.REASON_AR_UNAVAILABLE, getString(R.string.ar_error_generic)) }
        }
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        viewWidth = width
        viewHeight = height
        GLES20.glViewport(0, 0, width, height)
        displayRotationHelper.onSurfaceChanged(width, height)
    }

    override fun onDrawFrame(gl: GL10?) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
        val current = session ?: return
        if (!background.isReady || resultSent.get()) return
        try {
            if (!cameraTextureSet) {
                current.setCameraTextureName(background.textureId)
                cameraTextureSet = true
            }
            displayRotationHelper.updateSessionIfNeeded(current)
            val frame = current.update()
            background.draw(frame)
            val state = measure.onFrame(current, frame, viewWidth, viewHeight, commands)
            overlay.publish(state)
            postUiIfChanged(state)
        } catch (e: SessionPausedException) {
            // Pausing or resuming: skip this frame.
        } catch (e: CameraNotAvailableException) {
            Log.w(TAG, "Camera lost", e)
            runOnUiThread { finishCancelled(ArMeasurePlugin.REASON_AR_UNAVAILABLE, unavailableMessage(e)) }
        } catch (e: Exception) {
            Log.e(TAG, "AR frame failed", e)
            runOnUiThread { finishCancelled(ArMeasurePlugin.REASON_AR_UNAVAILABLE, getString(R.string.ar_error_generic)) }
        }
    }

    private fun postUiIfChanged(state: OverlayState) {
        val next = UiSnapshot(state.hint, state.warning, state.pointCount, state.planeLocked)
        if (next == lastUi) return
        lastUi = next
        runOnUiThread { applyUi(next) }
    }

    // MeasureSession.Listener: called on the GL thread.

    override fun onPlaneLocked() {
        runOnUiThread { tick() }
    }

    override fun onPointAdded() {
        runOnUiThread { tick() }
    }

    override fun onSaveReady(data: SaveData) {
        runOnUiThread { captureAndFinish(data) }
    }

    override fun onSaveUnavailable() {
        runOnUiThread {
            saving = false
            lastUi?.let { applyUi(it) }
        }
    }

    // ---- Main thread --------------------------------------------------------------------------

    private fun queue(command: Command) {
        if (!saving) commands.add(command)
    }

    private fun onSaveClicked() {
        if (saving) return
        saving = true
        saveButton.setText(R.string.ar_saving)
        setEnabled(saveButton, false)
        setEnabled(undoButton, false)
        setEnabled(clearButton, false)
        setEnabled(addButton, false)
        commands.add(Command.SAVE)
    }

    private fun applyUi(ui: UiSnapshot) {
        if (hintText.text?.toString() != ui.hint) hintText.text = ui.hint
        if (ui.warning != null) {
            if (warningText.text?.toString() != ui.warning) warningText.text = ui.warning
            warningText.visibility = View.VISIBLE
        } else {
            warningText.visibility = View.INVISIBLE
        }
        // Clear doubles as "Reset surface" when there are no points but a surface is locked.
        clearButton.setText(if (ui.pointCount == 0 && ui.planeLocked) R.string.ar_reset_surface else R.string.ar_clear)
        if (saving) return
        saveButton.setText(R.string.ar_save)
        setEnabled(saveButton, ui.pointCount == 2)
        setEnabled(undoButton, ui.pointCount > 0)
        setEnabled(clearButton, ui.pointCount > 0 || ui.planeLocked)
        setEnabled(addButton, true)
    }

    private fun setEnabled(view: View, enabled: Boolean) {
        view.isEnabled = enabled
        view.alpha = if (enabled) 1f else 0.45f
    }

    private fun tick() {
        val feedback =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                HapticFeedbackConstants.CONFIRM
            } else {
                HapticFeedbackConstants.VIRTUAL_KEY
            }
        overlay.performHapticFeedback(feedback)
    }

    private fun applySystemBarInsets() {
        val topBar = findViewById<View>(R.id.ar_top_bar)
        val bottomBar = findViewById<View>(R.id.ar_bottom_bar)
        // Paddings from the layout are symmetric, so left/right equal start/end.
        val top = topBar.paddingTop
        val topSide = topBar.paddingLeft
        val bottom = bottomBar.paddingBottom
        val bottomSide = bottomBar.paddingLeft
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.ar_root)) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            topBar.setPadding(topSide + bars.left, top + bars.top, topSide + bars.right, topBar.paddingBottom)
            bottomBar.setPadding(bottomSide + bars.left, bottomBar.paddingTop, bottomSide + bars.right, bottom + bars.bottom)
            insets
        }
        // Full-screen camera: hide the status bar; a swipe from the edge shows it again.
        WindowCompat.getInsetsController(window, window.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.statusBars())
        }
    }

    /**
     * Takes the screenshot (camera via PixelCopy + overlay drawn on top), writes it, and returns
     * the measurement. Without a screenshot if anything about the image fails.
     */
    private fun captureAndFinish(data: SaveData) {
        if (resultSent.get()) return
        val width = glView.width
        val height = glView.height
        if (width <= 0 || height <= 0) {
            finishWithMeasurement(data, null)
            return
        }
        val bitmap = createBitmap(width, height)
        try {
            PixelCopy.request(
                glView,
                bitmap,
                { result ->
                    if (result == PixelCopy.SUCCESS) {
                        // PixelCopy only sees the GL surface; draw the line and label on top.
                        overlay.drawForCapture(Canvas(bitmap))
                        Thread {
                            val shot = writeJpeg(bitmap)
                            runOnUiThread { finishWithMeasurement(data, shot) }
                        }.start()
                    } else {
                        Log.w(TAG, "PixelCopy failed: $result")
                        bitmap.recycle()
                        finishWithMeasurement(data, null)
                    }
                },
                Handler(Looper.getMainLooper()),
            )
        } catch (e: Exception) {
            Log.w(TAG, "PixelCopy could not start", e)
            bitmap.recycle()
            finishWithMeasurement(data, null)
        }
    }

    /** Scales to at most [MAX_IMAGE_EDGE] px and saves a JPEG in filesDir/measurements. Worker thread. */
    private fun writeJpeg(source: Bitmap): Screenshot? {
        var scaled: Bitmap? = null
        return try {
            val scale = MAX_IMAGE_EDGE.toFloat() / max(source.width, source.height)
            val image =
                if (scale < 1f) {
                    source.scale(
                        (source.width * scale).roundToInt().coerceAtLeast(1),
                        (source.height * scale).roundToInt().coerceAtLeast(1),
                    )
                } else {
                    source
                }
            scaled = image
            val dir = File(filesDir, MEASUREMENTS_DIR)
            if (!dir.isDirectory && !dir.mkdirs()) return null
            val file = File(dir, "${UUID.randomUUID()}.jpg")
            FileOutputStream(file).use { out ->
                if (!image.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)) return null
            }
            Screenshot(Uri.fromFile(file).toString(), image.width, image.height)
        } catch (e: Exception) {
            Log.w(TAG, "Screenshot could not be saved", e)
            null
        } finally {
            if (scaled != null && scaled !== source) scaled.recycle()
            source.recycle()
        }
    }

    private fun finishWithMeasurement(data: SaveData, shot: Screenshot?) {
        val result =
            try {
                measurementJson(data, shot)
            } catch (e: Exception) {
                Log.e(TAG, "Result could not be built", e)
                null
            }
        if (result == null) {
            finishCancelled(ArMeasurePlugin.REASON_AR_UNAVAILABLE, getString(R.string.ar_error_generic))
            return
        }
        sendResult(Activity.RESULT_OK, result)
    }

    private fun measurementJson(data: SaveData, shot: Screenshot?): JSONObject {
        val points = JSONArray()
        for (p in data.points) {
            points.put(JSONObject().put("x", round5(p.x.toDouble())).put("y", round5(p.y.toDouble())).put("z", round5(p.z.toDouble())))
        }
        val json =
            JSONObject()
                .put("cancelled", false)
                .put("mode", ArMeasurePlugin.MODE_DISTANCE)
                .put("unit", unit)
                .put("points", points)
                .put("distanceM", round5(data.distanceM))
                .put("createdAt", isoUtcNow())
        if (shot != null) {
            json.put(
                "screenshot",
                JSONObject()
                    .put("uri", shot.uri)
                    .put("width", shot.width)
                    .put("height", shot.height)
                    .put("mimeType", "image/jpeg"),
            )
        }
        return json
    }

    private fun finishCancelled(reason: String, message: String?) {
        val json = JSONObject().put("cancelled", true).put("reason", reason)
        if (message != null) json.put("message", message)
        sendResult(Activity.RESULT_CANCELED, json)
    }

    private fun sendResult(resultCode: Int, json: JSONObject) {
        if (!resultSent.compareAndSet(false, true)) return
        setResult(resultCode, Intent().putExtra(EXTRA_RESULT, json.toString()))
        finish()
    }

    // ARCore's Config setters return the Config, so they are chained rather than assigned.
    private fun sessionConfig(session: Session): Config =
        Config(session)
            .setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL)
            .setDepthMode(Config.DepthMode.DISABLED)
            .setInstantPlacementMode(Config.InstantPlacementMode.DISABLED)
            .setLightEstimationMode(Config.LightEstimationMode.DISABLED)
            .setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE)
            .setFocusMode(Config.FocusMode.AUTO)

    private fun unavailableMessage(e: Exception): String =
        getString(
            when (e) {
                is UnavailableArcoreNotInstalledException,
                is UnavailableUserDeclinedInstallationException,
                -> R.string.ar_error_not_installed
                is UnavailableApkTooOldException -> R.string.ar_error_apk_too_old
                is UnavailableSdkTooOldException -> R.string.ar_error_sdk_too_old
                is UnavailableDeviceNotCompatibleException -> R.string.ar_error_device_not_compatible
                is CameraNotAvailableException -> R.string.ar_error_camera_unavailable
                else -> R.string.ar_error_generic
            },
        )

    private fun hintTexts() =
        HintTexts(
            coaching = getString(R.string.ar_hint_coaching),
            surfaceFound = getString(R.string.ar_hint_surface_found),
            aimEnd = getString(R.string.ar_hint_aim_end),
            done = getString(R.string.ar_hint_done),
            tooDark = getString(R.string.ar_hint_too_dark),
            tooFast = getString(R.string.ar_hint_too_fast),
            lowTexture = getString(R.string.ar_hint_low_texture),
            cameraBusy = getString(R.string.ar_hint_camera_busy),
            gettingReady = getString(R.string.ar_hint_getting_ready),
            farWarning =
                getString(
                    if (unit == LengthFormat.UNIT_IN) R.string.ar_warning_far_imperial else R.string.ar_warning_far_metric,
                ),
        )

    companion object {
        /** Intent extra: the unit the user picked ("cm" or "in"). */
        const val EXTRA_UNIT = "com.foxysama.measuresama.ar.UNIT"

        /** Result extra: ArMeasurement or ArCancelled as a JSON string. */
        const val EXTRA_RESULT = "com.foxysama.measuresama.ar.RESULT"

        private const val TAG = "ArMeasureActivity"
        private const val MEASUREMENTS_DIR = "measurements"
        private const val MAX_IMAGE_EDGE = 1600
        private const val JPEG_QUALITY = 85

        private fun round5(value: Double): Double = Math.round(value * 100_000.0) / 100_000.0

        private fun isoUtcNow(): String {
            val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            format.timeZone = TimeZone.getTimeZone("UTC")
            return format.format(Date())
        }
    }
}
