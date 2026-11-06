package com.foxysama.measuresama.ar

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.util.TypedValue
import android.view.View
import java.util.concurrent.atomic.AtomicReference

/** Reticle look: searching for a surface, or aimed at one. */
enum class ReticleState { SEARCHING, ON_SURFACE }

/**
 * One frame of overlay content, built on the GL thread and never changed afterwards.
 * Positions are in view pixels of the camera view (same size as this overlay).
 */
data class OverlayState(
    val tracking: Boolean = false,
    val reticle: ScreenPoint? = null,
    val reticleState: ReticleState = ReticleState.SEARCHING,
    val points: List<ScreenPoint> = emptyList(),
    val line: ScreenSegment? = null,
    val label: String? = null,
    val labelPosition: ScreenPoint? = null,
    val hint: String? = null,
    val warning: String? = null,
    val pointCount: Int = 0,
    val planeLocked: Boolean = false,
)

/**
 * 2D overlay drawn over the camera: reticle, points, line and the distance label.
 * The GL thread publishes a new [OverlayState] each frame; this view only reads the latest one.
 * Hints and warnings are shown by TextViews in the activity, not drawn here.
 */
class MeasureOverlayView
@JvmOverloads
constructor(context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0) :
    View(context, attrs, defStyleAttr) {
    private val state = AtomicReference(OverlayState())

    /** When true (screenshot only), the reticle is left out. Main thread only. */
    private var capturing = false

    private val density = resources.displayMetrics.density

    private fun dp(value: Float) = value * density

    private fun sp(value: Float) =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, value, resources.displayMetrics)

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
    private val pointOutlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = INDIGO }
    private val pointFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
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
    private val reticleDotPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val labelBackgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = LABEL_BACKGROUND }
    private val labelTextPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = sp(22f)
            typeface = Typeface.DEFAULT_BOLD
            textAlign = Paint.Align.CENTER
        }
    private val labelRect = RectF()

    /** Called from the GL thread with the newest frame. */
    fun publish(next: OverlayState) {
        state.set(next)
        postInvalidate()
    }

    /** Draws the measurement (no reticle) onto [canvas], for the saved screenshot. Main thread. */
    fun drawForCapture(canvas: Canvas) {
        capturing = true
        try {
            draw(canvas)
        } finally {
            capturing = false
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val s = state.get()
        if (!s.tracking) return

        s.line?.let { line ->
            canvas.drawLine(line.start.x, line.start.y, line.end.x, line.end.y, lineShadowPaint)
            canvas.drawLine(line.start.x, line.start.y, line.end.x, line.end.y, linePaint)
        }
        for (p in s.points) {
            canvas.drawCircle(p.x, p.y, dp(10f), pointOutlinePaint)
            canvas.drawCircle(p.x, p.y, dp(6.5f), pointFillPaint)
        }
        if (!capturing) s.reticle?.let { drawReticle(canvas, it, s.reticleState) }

        val label = s.label
        val at = s.labelPosition
        if (label != null && at != null) drawLabel(canvas, label, at)
    }

    private fun drawReticle(canvas: Canvas, at: ScreenPoint, reticleState: ReticleState) {
        val radius = dp(22f)
        val onSurface = reticleState == ReticleState.ON_SURFACE
        reticlePaint.color = if (onSurface) AMBER else SEARCHING_WHITE
        reticleDotPaint.color = if (onSurface) AMBER else SEARCHING_WHITE
        canvas.drawCircle(at.x, at.y, radius, reticleShadowPaint)
        canvas.drawCircle(at.x, at.y, radius, reticlePaint)
        canvas.drawCircle(at.x, at.y, dp(if (onSurface) 4f else 3f), reticleDotPaint)
    }

    private fun drawLabel(canvas: Canvas, text: String, at: ScreenPoint) {
        val padX = dp(14f)
        val padY = dp(8f)
        val textWidth = labelTextPaint.measureText(text)
        val metrics = labelTextPaint.fontMetrics
        val textHeight = metrics.descent - metrics.ascent
        val halfW = textWidth / 2f + padX
        val halfH = textHeight / 2f + padY
        // Sit just above the line's midpoint, kept fully on screen.
        val margin = dp(8f)
        val cx = at.x.coerceIn(halfW + margin, (width - halfW - margin).coerceAtLeast(halfW + margin))
        val cy = (at.y - dp(32f)).coerceIn(halfH + margin, (height - halfH - margin).coerceAtLeast(halfH + margin))
        labelRect.set(cx - halfW, cy - halfH, cx + halfW, cy + halfH)
        canvas.drawRoundRect(labelRect, halfH, halfH, labelBackgroundPaint)
        val baseline = cy - (metrics.ascent + metrics.descent) / 2f
        canvas.drawText(text, cx, baseline, labelTextPaint)
    }

    private companion object {
        // Palette from src/styles/index.css: indigo primary, amber accent.
        val INDIGO = Color.rgb(0x37, 0x30, 0xA3)
        val AMBER = Color.rgb(0xFB, 0xBF, 0x24)
        val SEARCHING_WHITE = Color.argb(0xE6, 0xFF, 0xFF, 0xFF)
        val SHADOW = Color.argb(0x8C, 0x00, 0x00, 0x00)

        // White text on near-black: well above WCAG AA on any camera image.
        val LABEL_BACKGROUND = Color.argb(0xE6, 0x11, 0x18, 0x27)
    }
}
