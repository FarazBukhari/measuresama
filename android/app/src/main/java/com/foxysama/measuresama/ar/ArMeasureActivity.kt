package com.foxysama.measuresama.ar

import android.Manifest
import android.animation.ObjectAnimator
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
 * AR measuring screen for every AR mode (distance, path, area, angle, height, volume, room plan),
 * opened by [ArMeasurePlugin.start] with [EXTRA_MODE]. Returns one JSON result (an ArMeasurement
 * or an ArCancelled) in [EXTRA_RESULT].
 *
 * THREADING MODEL
 * - GL thread (GLSurfaceView renderer, [onDrawFrame]) is the only thread that touches ARCore
 *   frame data: Session.update(), hit tests, anchor creation/detach and all matrix math, through
 *   [MeasureSession].
 * - Main thread handles taps. The '+' button, a tap on the camera view, Undo, Clear and Save only
 *   add a [Command] to [commands] (a ConcurrentLinkedQueue); the GL thread drains it at the start
 *   of each frame.
 * - Each frame the GL thread builds an immutable [OverlayState] (projected points, lines, fill, arc,
 *   labels, reticle and its state, hint, distance warning, button states), publishes it to
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
    private lateinit var scanView: ScanAnimationView

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
    private var mode = MeasureMode.DISTANCE
    private var onSurface = false
    private var aimKind = AimKind.SURFACE
    private var snapClose = false
    private var scanShown = true
    private var hintOverride = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private val clearHintOverride = Runnable {
        hintOverride = false
        lastUi?.let { applyUi(it) }
    }

    /** The parts of [OverlayState] shown by regular views; posted to the main thread on change. */
    private data class UiSnapshot(
        val hint: String?,
        val warning: String?,
        val pointCount: Int,
        val planeLocked: Boolean,
        val onSurface: Boolean,
        val scanning: Boolean,
        val canSave: Boolean,
        val canUndo: Boolean,
        val canClear: Boolean,
        val aimKind: AimKind,
        val snapClose: Boolean,
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
        // Older callers sent no mode: that was always distance.
        mode = MeasureMode.fromId(intent.getStringExtra(EXTRA_MODE)) ?: MeasureMode.DISTANCE
        measure = MeasureSession(mode, unit, hintTexts(), this, resources.displayMetrics.density)
        displayRotationHelper = DisplayRotationHelper(this)

        glView = findViewById(R.id.ar_gl_view)
        overlay = findViewById(R.id.ar_overlay)
        hintText = findViewById(R.id.ar_hint)
        warningText = findViewById(R.id.ar_warning)
        undoButton = findViewById(R.id.ar_undo)
        clearButton = findViewById(R.id.ar_clear)
        saveButton = findViewById(R.id.ar_save)
        addButton = findViewById(R.id.ar_add)
        scanView = findViewById(R.id.ar_scan)
        findViewById<TextView>(R.id.ar_mode).setText(modeName(mode))
        // A docked label (e.g. a path's total) sits above the bottom controls.
        val bottomBar = findViewById<View>(R.id.ar_bottom_bar)
        bottomBar.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ -> overlay.dockBottomPx = v.height }

        glView.preserveEGLContextOnPause = true
        glView.setEGLContextClientVersion(2)
        glView.setEGLConfigChooser(8, 8, 8, 8, 16, 0)
        glView.setRenderer(this)
        glView.renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY

        overlay.setOnClickListener { onAddTapped() }
        addButton.setOnClickListener { onAddTapped() }
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
        applyUi(
            UiSnapshot(
                hint = getString(R.string.ar_hint_getting_ready),
                warning = null,
                pointCount = 0,
                planeLocked = false,
                onSurface = false,
                scanning = true,
                canSave = false,
                canUndo = false,
                canClear = false,
                aimKind = AimKind.SURFACE,
                snapClose = false,
            ),
        )
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
        mainHandler.removeCallbacks(clearHintOverride)
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
        val next =
            UiSnapshot(
                hint = state.hint,
                warning = state.warning,
                pointCount = state.pointCount,
                planeLocked = state.planeLocked,
                onSurface = state.onSurface,
                scanning = state.scanning,
                canSave = state.canSave,
                canUndo = state.canUndo,
                canClear = state.canClear,
                aimKind = state.aimKind,
                snapClose = state.snapClose,
            )
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

    override fun onAddRejected() {
        runOnUiThread { rejectAdd() }
    }

    override fun onSaveReady(result: ModeResult, capture: OverlayState) {
        runOnUiThread { captureAndFinish(result, capture) }
    }

    override fun onSaveUnavailable() {
        runOnUiThread {
            saving = false
            lastUi?.let { applyUi(it) }
        }
    }

    // ---- Main thread --------------------------------------------------------------------------

    /** Add-point tap. Always queued: the engine says (onAddRejected) if there is no surface. */
    private fun onAddTapped() {
        // The + button is dimmed (not disabled) off-surface, so a tap can be explained.
        if (!saving) commands.add(Command.ADD_POINT)
    }

    /** Main thread: the engine refused a tap. Shake +, buzz, and say what to do for a moment. */
    private fun rejectAdd() {
        if (saving) return
        val shake =
            ObjectAnimator.ofFloat(
                addButton,
                View.TRANSLATION_X,
                0f, -12f * resources.displayMetrics.density, 12f * resources.displayMetrics.density,
                -8f * resources.displayMetrics.density, 8f * resources.displayMetrics.density, 0f,
            )
        shake.duration = 300
        shake.start()
        val feedback =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                HapticFeedbackConstants.REJECT
            } else {
                HapticFeedbackConstants.LONG_PRESS
            }
        overlay.performHapticFeedback(feedback)
        hintOverride = true
        hintText.text =
            getString(
                when (aimKind) {
                    AimKind.FLOOR -> R.string.ar_hint_aim_floor
                    AimKind.VERTICAL -> R.string.ar_hint_raise_top
                    AimKind.SURFACE -> R.string.ar_hint_aim_surface
                },
            )
        mainHandler.removeCallbacks(clearHintOverride)
        mainHandler.postDelayed(clearHintOverride, 1500)
    }

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
        if (!hintOverride && hintText.text?.toString() != ui.hint) hintText.text = ui.hint
        updateScan(ui.scanning)
        onSurface = ui.onSurface
        aimKind = ui.aimKind
        snapClose = ui.snapClose
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
        setEnabled(saveButton, ui.canSave)
        setEnabled(undoButton, ui.canUndo)
        setEnabled(clearButton, ui.canClear)
        setEnabled(addButton, true)
        applyAddState()
    }

    /** + looks off (but stays tappable) until the circle is on a surface. */
    private fun applyAddState() {
        addButton.alpha = if (onSurface) 1f else 0.4f
        addButton.contentDescription =
            getString(
                when {
                    snapClose -> R.string.ar_close_room_action
                    onSurface -> R.string.ar_add_point
                    aimKind == AimKind.FLOOR -> R.string.ar_add_point_floor_blocked
                    else -> R.string.ar_add_point_blocked
                },
            )
    }

    /** Scan animation shows until a surface locks, then fades out over 200 ms. */
    private fun updateScan(scanning: Boolean) {
        if (scanning == scanShown) return
        scanShown = scanning
        scanView.animate().cancel()
        if (scanning) {
            scanView.alpha = 1f
            scanView.visibility = View.VISIBLE
        } else {
            scanView.animate().alpha(0f).setDuration(200).withEndAction {
                if (!scanShown) scanView.visibility = View.GONE
            }.start()
        }
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
    private fun captureAndFinish(data: ModeResult, capture: OverlayState) {
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
                        // PixelCopy only sees the GL surface; draw the measurement on top.
                        overlay.drawForCapture(Canvas(bitmap), capture)
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

    private fun finishWithMeasurement(data: ModeResult, shot: Screenshot?) {
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

    /** The ArMeasurement JSON. Field order for distance is unchanged: cancelled, mode, unit, points, distanceM, createdAt, screenshot. */
    private fun measurementJson(data: ModeResult, shot: Screenshot?): JSONObject {
        val points = JSONArray()
        for (p in data.points) {
            val xyz = MeasurementFields.point(p)
            points.put(JSONObject().put("x", xyz[0]).put("y", xyz[1]).put("z", xyz[2]))
        }
        val json =
            JSONObject()
                .put("cancelled", false)
                .put("mode", data.mode.id)
                .put("unit", unit)
                .put("points", points)
        for ((key, value) in MeasurementFields.of(data)) {
            when (value) {
                is List<*> -> json.put(key, JSONArray().apply { value.forEach { put(it) } })
                else -> json.put(key, value)
            }
        }
        json.put("createdAt", isoUtcNow())
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

    private fun modeName(mode: MeasureMode): Int =
        when (mode) {
            MeasureMode.DISTANCE -> R.string.ar_mode_distance
            MeasureMode.PATH -> R.string.ar_mode_path
            MeasureMode.AREA -> R.string.ar_mode_area
            MeasureMode.ANGLE -> R.string.ar_mode_angle
            MeasureMode.HEIGHT -> R.string.ar_mode_height
            MeasureMode.VOLUME -> R.string.ar_mode_volume
            MeasureMode.ROOM_PLAN -> R.string.ar_mode_room_plan
        }

    private fun progressHint(key: ProgressKey): Int =
        when (key) {
            ProgressKey.START -> R.string.ar_hint_surface_found
            ProgressKey.END -> R.string.ar_hint_aim_end
            ProgressKey.NEXT -> R.string.ar_hint_next
            ProgressKey.ADD_OR_SAVE -> R.string.ar_hint_add_or_save
            ProgressKey.CORNER -> R.string.ar_hint_corner
            ProgressKey.NEXT_CORNER -> R.string.ar_hint_next_corner
            ProgressKey.VERTEX -> R.string.ar_hint_vertex
            ProgressKey.OTHER_END -> R.string.ar_hint_other_end
            ProgressKey.BASE -> R.string.ar_hint_base
            ProgressKey.RAISE_TOP -> R.string.ar_hint_raise_top
            ProgressKey.CLOSE_OR_SAVE -> R.string.ar_hint_close_or_save
            ProgressKey.WALL_HEIGHT -> R.string.ar_hint_wall_height
            ProgressKey.DONE -> R.string.ar_hint_done
        }

    private fun hintTexts() =
        HintTexts(
            coaching = getString(R.string.ar_hint_coaching),
            aimFloor = getString(R.string.ar_hint_aim_floor),
            closeRoom = getString(R.string.ar_hint_close_room),
            progress = ProgressKey.entries.associateWith { getString(progressHint(it)) },
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

        /** Intent extra: the AR mode id ([MeasureMode.id]). Missing or unknown means distance. */
        const val EXTRA_MODE = "com.foxysama.measuresama.ar.MODE"

        /** Result extra: ArMeasurement or ArCancelled as a JSON string. */
        const val EXTRA_RESULT = "com.foxysama.measuresama.ar.RESULT"

        private const val TAG = "ArMeasureActivity"
        private const val MEASUREMENTS_DIR = "measurements"
        private const val MAX_IMAGE_EDGE = 1600
        private const val JPEG_QUALITY = 85

        private fun isoUtcNow(): String {
            val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            format.timeZone = TimeZone.getTimeZone("UTC")
            return format.format(Date())
        }
    }
}

/**
 * The per-mode fields of an ArMeasurement (definitions.ts), in output order, rounded like the
 * contract: 5 decimals, angleDeg 3. Pure (no org.json), so the field names are unit-tested.
 * Values are Double or List<Double>. Only the fields the mode's ModeResult sets are included.
 */
object MeasurementFields {
    fun of(result: ModeResult): List<Pair<String, Any>> {
        val out = ArrayList<Pair<String, Any>>()
        fun put(key: String, value: Double?) {
            if (value != null) out.add(key to round5(value))
        }
        put("distanceM", result.distanceM)
        result.segmentsM?.let { out.add("segmentsM" to it.map(::round5)) }
        put("perimeterM", result.perimeterM)
        put("areaM2", result.areaM2)
        result.angleDeg?.let { out.add("angleDeg" to round3(it)) }
        put("heightM", result.heightM)
        put("lengthM", result.lengthM)
        put("widthM", result.widthM)
        put("volumeM3", result.volumeM3)
        put("wallHeightM", result.wallHeightM)
        return out
    }

    /** A point's x, y, z rounded to 5 decimals. */
    fun point(p: Vec3): DoubleArray = doubleArrayOf(round5(p.x.toDouble()), round5(p.y.toDouble()), round5(p.z.toDouble()))

    fun round5(value: Double): Double = Math.round(value * 100_000.0) / 100_000.0

    fun round3(value: Double): Double = Math.round(value * 1_000.0) / 1_000.0
}
