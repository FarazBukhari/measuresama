package com.foxysama.measuresama.ar

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import android.util.AttributeSet
import android.util.TypedValue
import android.view.View
import androidx.core.graphics.withClip
import androidx.core.graphics.withRotation
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.PI
import kotlin.math.sin

/** Reticle look: searching for a surface, or aimed at one. */
enum class ReticleState { SEARCHING, ON_SURFACE }

/** A projected line; [dashed] marks a shape's closing side. */
data class OverlayLine(val segment: ScreenSegment, val dashed: Boolean = false)

/** A small text label centred on [at] (view pixels). */
data class OverlayLabel(val text: String, val at: ScreenPoint)

/** An arc around [center] from [startDeg], sweeping [sweepDeg] (Canvas degrees: clockwise, 0 = right). */
data class AngleArc(val center: ScreenPoint, val startDeg: Float, val sweepDeg: Float)

/**
 * One frame of overlay content, built on the GL thread and never changed afterwards.
 * Positions are in view pixels of the camera view (same size as this overlay).
 */
data class OverlayState(
    val tracking: Boolean = false,
    val reticle: ScreenPoint? = null,
    val reticleState: ReticleState = ReticleState.SEARCHING,
    /** Room plan: the aim snapped onto the first corner, so a tap closes the room. */
    val snapClose: Boolean = false,
    /** Placed points (room plan: corners, then the wall top). */
    val points: List<ScreenPoint> = emptyList(),
    /** Where the next tap would put a point, when it is not exactly under the reticle. */
    val preview: ScreenPoint? = null,
    val lines: List<OverlayLine> = emptyList(),
    /** Area / room plan / box floor: the shape to tint, or null. */
    val fill: List<ScreenPoint>? = null,
    /** Dashed vertical guide while aiming up from a base point. */
    val guide: ScreenSegment? = null,
    val arc: AngleArc? = null,
    /** Small length labels on the sides. */
    val segmentLabels: List<OverlayLabel> = emptyList(),
    /** The main number. Drawn just above [labelPosition], or above the bottom bar when that is null. */
    val label: String? = null,
    val labelPosition: ScreenPoint? = null,
    /** Centre the main label on [labelPosition] (inside a shape, by an arc) instead of just above it. */
    val labelCentered: Boolean = false,
    val hint: String? = null,
    val warning: String? = null,
    val pointCount: Int = 0,
    val planeLocked: Boolean = false,
    /** The aim circle is on a surface (a point can be added). */
    val onSurface: Boolean = false,
    /** No surface found yet in this session (or since Clear/Reset): show the scan animation. */
    val scanning: Boolean = true,
    val canSave: Boolean = false,
    val canUndo: Boolean = false,
    val canClear: Boolean = false,
    /** What the next point needs (for the + button's explanation). */
    val aimKind: AimKind = AimKind.SURFACE,
)

/**
 * 2D overlay drawn over the camera: reticle, points, lines, shape fill, angle arc and labels.
 * The GL thread publishes a new [OverlayState] each frame; this view only reads the latest one.
 * Hints and warnings are shown by TextViews in the activity, not drawn here.
 *
 * Look (design-system MASTER, "AR screen"): tape yellow and ink only, white edges and a dark
 * shadow so every mark reads over any camera picture. Numbers sit on small tape pills; the main
 * number's pill has tick marks along its top edge, like the app's tape readout.
 */
class MeasureOverlayView
@JvmOverloads
constructor(context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0) :
    View(context, attrs, defStyleAttr) {
    private val state = AtomicReference(OverlayState())

    /** When true (screenshot only), the reticle and the preview dot are left out. Main thread only. */
    private var capturing = false

    /** Height of the controls along the bottom edge; a docked main label sits above it. Main thread. */
    var dockBottomPx: Int = 0

    /** Main thread: the reticle state last drawn, and when the "surface found" pop started. */
    private var lastReticleState = ReticleState.SEARCHING
    private var popStartMs = 0L

    /** System animations on (Settings > Accessibility > Remove animations is off). Main thread. */
    private var animationsOn = true

    private val density = resources.displayMetrics.density

    private fun dp(value: Float) = value * density

    private fun sp(value: Float) =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, value, resources.displayMetrics)

    private val heavy: Typeface =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) Typeface.create(Typeface.DEFAULT, 800, false) else Typeface.DEFAULT_BOLD

    private val dashEffect = DashPathEffect(floatArrayOf(dp(6f), dp(6f)), 0f)
    private val lineDashEffect = DashPathEffect(floatArrayOf(dp(10f), dp(8f)), 0f)

    private val lineShadowPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = SHADOW
            strokeWidth = dp(7.5f)
            strokeCap = Paint.Cap.ROUND
            style = Paint.Style.STROKE
        }
    private val lineEdgePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            strokeWidth = dp(5f)
            strokeCap = Paint.Cap.ROUND
            style = Paint.Style.STROKE
        }
    private val linePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = TAPE
            strokeWidth = dp(3f)
            strokeCap = Paint.Cap.ROUND
            style = Paint.Style.STROKE
        }
    private val dashedShadowPaint = Paint(lineShadowPaint).apply { pathEffect = lineDashEffect; strokeCap = Paint.Cap.BUTT }
    private val dashedEdgePaint = Paint(lineEdgePaint).apply { pathEffect = lineDashEffect; strokeCap = Paint.Cap.BUTT }
    private val dashedLinePaint = Paint(linePaint).apply { pathEffect = lineDashEffect; strokeCap = Paint.Cap.BUTT }
    private val guidePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = SEARCHING_WHITE
            strokeWidth = dp(2f)
            style = Paint.Style.STROKE
            pathEffect = dashEffect
        }
    private val guideShadowPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = SHADOW
            strokeWidth = dp(4.5f)
            style = Paint.Style.STROKE
            pathEffect = dashEffect
        }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = TAPE_FILL }
    private val arcPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = TAPE
            strokeWidth = dp(3f)
            strokeCap = Paint.Cap.ROUND
            style = Paint.Style.STROKE
        }
    private val arcShadowPaint = Paint(arcPaint).apply { color = SHADOW; strokeWidth = dp(6.5f) }
    private val pointShadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = SHADOW }
    private val pointEdgePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val pointFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = TAPE }
    private val previewPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = TAPE
            strokeWidth = dp(2.5f)
            style = Paint.Style.STROKE
        }
    private val reticleShadowPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = SHADOW
            strokeWidth = dp(5f)
            style = Paint.Style.STROKE
        }
    private val reticlePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            strokeWidth = dp(3f)
            style = Paint.Style.STROKE
        }
    private val searchingPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = SEARCHING_WHITE
            strokeWidth = dp(2f)
            style = Paint.Style.STROKE
            pathEffect = dashEffect
        }
    private val searchingShadowPaint = Paint(reticleShadowPaint).apply { strokeWidth = dp(4f); pathEffect = dashEffect }
    private val snapRingPaint = Paint(reticlePaint)
    private val reticleDotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = TAPE }
    private val labelBackgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = TAPE }
    private val labelEdgePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = PILL_EDGE
            strokeWidth = dp(1.5f)
            style = Paint.Style.STROKE
        }
    private val tickPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = TICK_INK
            strokeWidth = dp(1.25f)
            strokeCap = Paint.Cap.ROUND
        }
    private val labelTextPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = INK
            textSize = sp(26f)
            typeface = heavy
            textAlign = Paint.Align.CENTER
            fontFeatureSettings = "tnum"
        }
    private val smallLabelTextPaint = Paint(labelTextPaint).apply { textSize = sp(14f) }
    private val labelRect = RectF()
    private val arcRect = RectF()
    private val path = Path()
    private val clip = Path()

    /** Called from the GL thread with the newest frame. */
    fun publish(next: OverlayState) {
        state.set(next)
        postInvalidate()
    }

    /**
     * Draws [captured] (the finished measurement, no preview) without the reticle onto [canvas],
     * for the saved screenshot. Main thread.
     */
    fun drawForCapture(canvas: Canvas, captured: OverlayState) {
        capturing = true
        try {
            drawState(canvas, captured)
        } finally {
            capturing = false
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        readAnimationSetting()
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        // The setting can change while the screen is in the background.
        if (visibility == VISIBLE) readAnimationSetting()
    }

    private fun readAnimationSetting() {
        animationsOn = Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        drawState(canvas, state.get())
    }

    private fun drawState(canvas: Canvas, s: OverlayState) {
        if (!s.tracking) return

        s.fill?.let { drawFill(canvas, it) }
        s.guide?.let { drawPath(canvas, it, guideShadowPaint, guidePaint) }
        for (line in s.lines) {
            val seg = line.segment
            if (line.dashed) {
                drawPath(canvas, seg, dashedShadowPaint, dashedEdgePaint, dashedLinePaint)
            } else {
                canvas.drawLine(seg.start.x, seg.start.y, seg.end.x, seg.end.y, lineShadowPaint)
                canvas.drawLine(seg.start.x, seg.start.y, seg.end.x, seg.end.y, lineEdgePaint)
                canvas.drawLine(seg.start.x, seg.start.y, seg.end.x, seg.end.y, linePaint)
            }
        }
        s.arc?.let { drawArc(canvas, it) }
        for (p in s.points) {
            canvas.drawCircle(p.x, p.y, dp(9f), pointShadowPaint)
            canvas.drawCircle(p.x, p.y, dp(7.5f), pointEdgePaint)
            canvas.drawCircle(p.x, p.y, dp(5.5f), pointFillPaint)
        }
        if (!capturing) {
            s.preview?.let {
                canvas.drawCircle(it.x, it.y, dp(7f), reticleShadowPaint)
                canvas.drawCircle(it.x, it.y, dp(7f), previewPaint)
            }
            if (!s.scanning) {
                s.reticle?.let { drawReticle(canvas, it, s.reticleState, s.snapClose) }
            }
            lastReticleState = if (s.scanning || s.reticle == null) ReticleState.SEARCHING else s.reticleState
        }

        for (l in s.segmentLabels) drawLabel(canvas, l.text, l.at, smallLabelTextPaint, dp(10f), dp(5f), 0f, ticks = false)
        val label = s.label ?: return
        val at = s.labelPosition
        if (at != null) {
            // Just above a line's middle, or centred in a shape; kept fully on screen.
            drawLabel(canvas, label, at, labelTextPaint, dp(16f), dp(10f), if (s.labelCentered) 0f else dp(34f), ticks = true)
        } else {
            // Docked above the bottom controls: the tape strip.
            val y = height - dockBottomPx - dp(48f)
            drawLabel(canvas, label, ScreenPoint(width / 2f, y), labelTextPaint, dp(16f), dp(10f), 0f, ticks = true)
        }
    }

    private fun drawFill(canvas: Canvas, polygon: List<ScreenPoint>) {
        if (polygon.size < 3) return
        path.reset()
        path.moveTo(polygon[0].x, polygon[0].y)
        for (i in 1 until polygon.size) path.lineTo(polygon[i].x, polygon[i].y)
        path.close()
        canvas.drawPath(path, fillPaint)
    }

    private fun drawPath(canvas: Canvas, seg: ScreenSegment, vararg paints: Paint) {
        path.reset()
        path.moveTo(seg.start.x, seg.start.y)
        path.lineTo(seg.end.x, seg.end.y)
        for (paint in paints) canvas.drawPath(path, paint)
    }

    private fun drawArc(canvas: Canvas, arc: AngleArc) {
        val r = dp(ARC_RADIUS_DP)
        arcRect.set(arc.center.x - r, arc.center.y - r, arc.center.x + r, arc.center.y + r)
        canvas.drawArc(arcRect, arc.startDeg, arc.sweepDeg, false, arcShadowPaint)
        canvas.drawArc(arcRect, arc.startDeg, arc.sweepDeg, false, arcPaint)
    }

    private fun drawReticle(canvas: Canvas, at: ScreenPoint, reticleState: ReticleState, snapClose: Boolean) {
        if (reticleState == ReticleState.ON_SURFACE) {
            // Solid white ring with a tape-yellow centre dot. It pops (1.0 -> 1.15 -> 1.0) when found.
            val now = SystemClock.uptimeMillis()
            if (lastReticleState != ReticleState.ON_SURFACE) popStartMs = now
            val elapsed = now - popStartMs
            val scale =
                if (animationsOn && elapsed < POP_MS) {
                    postInvalidateOnAnimation()
                    1f + 0.15f * sin(PI * elapsed / POP_MS).toFloat()
                } else {
                    1f
                }
            val radius = dp(26f) * scale
            canvas.drawCircle(at.x, at.y, radius, reticleShadowPaint)
            canvas.drawCircle(at.x, at.y, radius, reticlePaint)
            canvas.drawCircle(at.x, at.y, dp(5f), pointShadowPaint)
            canvas.drawCircle(at.x, at.y, dp(4f), reticleDotPaint)
            if (snapClose) {
                // Snapped onto the first corner: a second white ring around it says "tap to close".
                canvas.drawCircle(at.x, at.y, dp(36f), reticleShadowPaint)
                canvas.drawCircle(at.x, at.y, dp(36f), snapRingPaint)
            }
        } else {
            // Thin white dashed ring, slowly turning (still when animations are off), no centre dot.
            val radius = dp(24f)
            val angle = if (animationsOn) (SystemClock.uptimeMillis() % SPIN_MS) * 360f / SPIN_MS else 0f
            if (animationsOn) postInvalidateOnAnimation()
            canvas.withRotation(angle, at.x, at.y) {
                drawCircle(at.x, at.y, radius, searchingShadowPaint)
                drawCircle(at.x, at.y, radius, searchingPaint)
            }
        }
    }

    private fun drawLabel(
        canvas: Canvas,
        text: String,
        at: ScreenPoint,
        textPaint: Paint,
        padX: Float,
        padY: Float,
        raise: Float,
        ticks: Boolean,
    ) {
        val textWidth = textPaint.measureText(text)
        val metrics = textPaint.fontMetrics
        val textHeight = metrics.descent - metrics.ascent
        val halfW = textWidth / 2f + padX
        val halfH = textHeight / 2f + padY
        // Kept fully on screen.
        val margin = dp(8f)
        val cx = at.x.coerceIn(halfW + margin, (width - halfW - margin).coerceAtLeast(halfW + margin))
        val cy = (at.y - raise).coerceIn(halfH + margin, (height - halfH - margin).coerceAtLeast(halfH + margin))
        labelRect.set(cx - halfW, cy - halfH, cx + halfW, cy + halfH)
        canvas.drawRoundRect(labelRect, halfH, halfH, labelBackgroundPaint)
        if (ticks) drawTicks(canvas, labelRect, halfH)
        canvas.drawRoundRect(labelRect, halfH, halfH, labelEdgePaint)
        val baseline = cy - (metrics.ascent + metrics.descent) / 2f
        canvas.drawText(text, cx, baseline, textPaint)
    }

    /** Tape tick marks hanging from the pill's top edge: short every step, long every fifth. */
    private fun drawTicks(canvas: Canvas, rect: RectF, radius: Float) {
        clip.reset()
        clip.addRoundRect(rect, radius, radius, Path.Direction.CW)
        val step = dp(6f)
        canvas.withClip(clip) {
            var i = 0
            var x = rect.left + step
            while (x < rect.right) {
                val len = if (i % 5 == 0) dp(7f) else dp(4f)
                drawLine(x, rect.top, x, rect.top + len, tickPaint)
                x += step
                i++
            }
        }
    }

    companion object {
        /** Radius of the angle arc, in dp. The session places the angle label just outside it. */
        const val ARC_RADIUS_DP = 34f

        private const val SPIN_MS = 8000L
        private const val POP_MS = 200L

        // Tape palette (design-system MASTER, "AR screen"): tape yellow, ink, white, black shadow.
        private val TAPE = Color.rgb(0xFF, 0xC6, 0x29)
        private val TAPE_FILL = Color.argb(0x40, 0xFF, 0xC6, 0x29)
        private val INK = Color.rgb(0x14, 0x14, 0x14)
        private val TICK_INK = Color.argb(0x8C, 0x14, 0x14, 0x14)
        private val SEARCHING_WHITE = Color.argb(0xE6, 0xFF, 0xFF, 0xFF)
        private val SHADOW = Color.argb(0x8C, 0x00, 0x00, 0x00)

        // Ink on tape yellow is about 12:1, whatever the camera shows; the edge keeps the pill
        // apart from a yellow wall.
        private val PILL_EDGE = Color.argb(0x66, 0x00, 0x00, 0x00)
    }
}
