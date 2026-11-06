package com.foxysama.measuresama.ar

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.os.SystemClock
import android.util.AttributeSet
import android.util.TypedValue
import android.view.View
import java.util.concurrent.atomic.AtomicReference

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

    private val density = resources.displayMetrics.density

    private fun dp(value: Float) = value * density

    private fun sp(value: Float) =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, value, resources.displayMetrics)

    private val dashEffect = DashPathEffect(floatArrayOf(dp(6f), dp(6f)), 0f)
    private val lineDashEffect = DashPathEffect(floatArrayOf(dp(10f), dp(8f)), 0f)

    private val lineShadowPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = SHADOW
            strokeWidth = dp(7f)
            strokeCap = Paint.Cap.ROUND
            style = Paint.Style.STROKE
        }
    private val linePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            strokeWidth = dp(3.5f)
            strokeCap = Paint.Cap.ROUND
            style = Paint.Style.STROKE
        }
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
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = AMBER_FILL }
    private val arcPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AMBER
            strokeWidth = dp(3f)
            strokeCap = Paint.Cap.ROUND
            style = Paint.Style.STROKE
        }
    private val arcShadowPaint = Paint(arcPaint).apply { color = SHADOW; strokeWidth = dp(6f) }
    private val pointOutlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = INDIGO }
    private val pointFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val previewPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = AMBER
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
            strokeWidth = dp(2.5f)
            style = Paint.Style.STROKE
        }
    private val snapRingPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            strokeWidth = dp(3f)
            style = Paint.Style.STROKE
        }
    private val reticleDotPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val labelBackgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = LABEL_BACKGROUND }
    private val labelTextPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = sp(22f)
            typeface = Typeface.DEFAULT_BOLD
            textAlign = Paint.Align.CENTER
        }
    private val smallLabelTextPaint = Paint(labelTextPaint).apply { textSize = sp(14f) }
    private val labelRect = RectF()
    private val arcRect = RectF()
    private val path = Path()

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
                drawPath(canvas, seg, lineShadowPaint, dashedLinePaint)
            } else {
                canvas.drawLine(seg.start.x, seg.start.y, seg.end.x, seg.end.y, lineShadowPaint)
                canvas.drawLine(seg.start.x, seg.start.y, seg.end.x, seg.end.y, linePaint)
            }
        }
        s.arc?.let { drawArc(canvas, it) }
        for (p in s.points) {
            canvas.drawCircle(p.x, p.y, dp(10f), pointOutlinePaint)
            canvas.drawCircle(p.x, p.y, dp(6.5f), pointFillPaint)
        }
        if (!capturing) {
            s.preview?.let {
                canvas.drawCircle(it.x, it.y, dp(7f), reticleShadowPaint)
                canvas.drawCircle(it.x, it.y, dp(7f), previewPaint)
            }
            if (!s.scanning) {
                s.reticle?.let { drawReticle(canvas, it, s.reticleState, s.snapClose) }
                // Keep the dashed ring turning while searching.
                if (s.reticleState == ReticleState.SEARCHING) postInvalidateOnAnimation()
            }
        }

        for (l in s.segmentLabels) drawLabel(canvas, l.text, l.at, smallLabelTextPaint, dp(10f), dp(5f), 0f)
        val label = s.label ?: return
        val at = s.labelPosition
        if (at != null) {
            // Just above a line's middle, or centred in a shape; kept fully on screen.
            drawLabel(canvas, label, at, labelTextPaint, dp(14f), dp(8f), if (s.labelCentered) 0f else dp(32f))
        } else {
            // Docked above the bottom controls.
            val y = height - dockBottomPx - dp(48f)
            drawLabel(canvas, label, ScreenPoint(width / 2f, y), labelTextPaint, dp(14f), dp(8f), 0f)
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

    private fun drawPath(canvas: Canvas, seg: ScreenSegment, shadow: Paint, paint: Paint) {
        path.reset()
        path.moveTo(seg.start.x, seg.start.y)
        path.lineTo(seg.end.x, seg.end.y)
        canvas.drawPath(path, shadow)
        canvas.drawPath(path, paint)
    }

    private fun drawArc(canvas: Canvas, arc: AngleArc) {
        val r = dp(ARC_RADIUS_DP)
        arcRect.set(arc.center.x - r, arc.center.y - r, arc.center.x + r, arc.center.y + r)
        canvas.drawArc(arcRect, arc.startDeg, arc.sweepDeg, false, arcShadowPaint)
        canvas.drawArc(arcRect, arc.startDeg, arc.sweepDeg, false, arcPaint)
    }

    private fun drawReticle(canvas: Canvas, at: ScreenPoint, reticleState: ReticleState, snapClose: Boolean) {
        if (reticleState == ReticleState.ON_SURFACE) {
            // Solid amber ring and a filled centre dot, a bit bigger.
            val radius = dp(26f)
            reticlePaint.color = AMBER
            reticlePaint.pathEffect = null
            reticleDotPaint.color = AMBER
            canvas.drawCircle(at.x, at.y, radius, reticleShadowPaint)
            canvas.drawCircle(at.x, at.y, radius, reticlePaint)
            canvas.drawCircle(at.x, at.y, dp(5f), reticleDotPaint)
            if (snapClose) {
                // Snapped onto the first corner: a white ring around it says "tap to close".
                canvas.drawCircle(at.x, at.y, dp(36f), reticleShadowPaint)
                canvas.drawCircle(at.x, at.y, dp(36f), snapRingPaint)
            }
        } else {
            // Thin white dashed ring, slowly turning, no centre dot, a bit smaller.
            val radius = dp(20f)
            val angle = (SystemClock.uptimeMillis() % SPIN_MS) * 360f / SPIN_MS
            reticlePaint.color = SEARCHING_WHITE
            reticlePaint.pathEffect = dashEffect
            val thin = reticlePaint.strokeWidth
            reticlePaint.strokeWidth = dp(1.5f)
            canvas.save()
            canvas.rotate(angle, at.x, at.y)
            canvas.drawCircle(at.x, at.y, radius, reticleShadowPaint)
            canvas.drawCircle(at.x, at.y, radius, reticlePaint)
            canvas.restore()
            reticlePaint.strokeWidth = thin
            reticlePaint.pathEffect = null
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
        val baseline = cy - (metrics.ascent + metrics.descent) / 2f
        canvas.drawText(text, cx, baseline, textPaint)
    }

    companion object {
        /** Radius of the angle arc, in dp. The session places the angle label just outside it. */
        const val ARC_RADIUS_DP = 34f

        private const val SPIN_MS = 8000L

        // Palette from src/styles/index.css: indigo primary, amber accent.
        private val INDIGO = Color.rgb(0x37, 0x30, 0xA3)
        private val AMBER = Color.rgb(0xFB, 0xBF, 0x24)
        private val AMBER_FILL = Color.argb(0x33, 0xFB, 0xBF, 0x24)
        private val SEARCHING_WHITE = Color.argb(0xE6, 0xFF, 0xFF, 0xFF)
        private val SHADOW = Color.argb(0x8C, 0x00, 0x00, 0x00)

        // White text on near-black: well above WCAG AA on any camera image.
        private val LABEL_BACKGROUND = Color.argb(0xE6, 0x11, 0x18, 0x27)
    }
}
