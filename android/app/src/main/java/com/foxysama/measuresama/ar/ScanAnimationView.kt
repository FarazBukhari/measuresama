package com.foxysama.measuresama.ar

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.provider.Settings
import android.util.AttributeSet
import android.view.View
import android.view.animation.LinearInterpolator

/**
 * Original looping "move your phone" animation: a phone outline sweeps left and right in a gentle
 * arc over a tilted surface with a few tape-yellow dots, on a 60% black round backdrop. Drawn with
 * Canvas only.
 * Runs only while attached and visible. With animations turned off in system settings it draws one
 * still frame.
 */
class ScanAnimationView
@JvmOverloads
constructor(context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0) :
    View(context, attrs, defStyleAttr) {
    private val density = resources.displayMetrics.density
    private fun dp(v: Float) = v * density

    /** 0..1, driven back and forth by the animator. */
    private var t = 0.5f
    private var animator: ValueAnimator? = null

    private val backdropPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(0x99, 0x00, 0x00, 0x00) }
    private val surfaceFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(0x33, 0xFF, 0xFF, 0xFF) }
    private val surfaceLine =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(0x99, 0xFF, 0xFF, 0xFF)
            style = Paint.Style.STROKE
            strokeWidth = dp(1.2f)
        }
    private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(0xFF, 0xC6, 0x29) }
    private val phonePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = dp(2.5f)
        }
    private val cameraPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val path = Path()
    private val rect = RectF()

    private fun animationsOn(): Boolean =
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f

    private fun updateAnimator() {
        val shouldRun = isAttachedToWindow && visibility == VISIBLE && windowVisibility == VISIBLE && animationsOn()
        if (shouldRun) {
            if (animator?.isRunning == true) return
            animator =
                ValueAnimator.ofFloat(0f, 1f).apply {
                    duration = 2400
                    repeatCount = ValueAnimator.INFINITE
                    repeatMode = ValueAnimator.REVERSE
                    interpolator = LinearInterpolator()
                    addUpdateListener {
                        t = it.animatedValue as Float
                        invalidate()
                    }
                    start()
                }
        } else {
            animator?.cancel()
            animator = null
            t = 0.5f
            invalidate()
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        updateAnimator()
    }

    override fun onDetachedFromWindow() {
        animator?.cancel()
        animator = null
        super.onDetachedFromWindow()
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        updateAnimator()
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        updateAnimator()
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        val cx = w / 2f
        val cy = h / 2f
        canvas.drawCircle(cx, cy, minOf(w, h) / 2f, backdropPaint)

        // Tilted surface (parallelogram, narrower at the far edge).
        path.reset()
        path.moveTo(cx - w * 0.20f, cy + h * 0.05f)
        path.lineTo(cx + w * 0.20f, cy + h * 0.05f)
        path.lineTo(cx + w * 0.34f, cy + h * 0.30f)
        path.lineTo(cx - w * 0.34f, cy + h * 0.30f)
        path.close()
        canvas.drawPath(path, surfaceFill)
        canvas.drawPath(path, surfaceLine)
        // Grid lines and dots.
        for (i in 1..2) {
            val f = i / 3f
            val y = cy + h * (0.05f + 0.25f * f)
            val half = w * (0.20f + 0.14f * f)
            canvas.drawLine(cx - half, y, cx + half, y, surfaceLine)
        }
        for (r in 0..1) {
            for (c in -1..1) {
                val f = 0.25f + 0.5f * r
                val y = cy + h * (0.05f + 0.25f * f)
                val x = cx + c * w * (0.10f + 0.07f * f)
                canvas.drawCircle(x, y, dp(2.5f), dotPaint)
            }
        }

        // Phone sweeping left to right on a gentle arc; tilts with the sweep.
        val p = t * 2f - 1f
        val px = cx + p * w * 0.22f
        val py = cy - h * 0.12f - (1f - p * p) * h * 0.06f
        canvas.save()
        canvas.rotate(p * 12f, px, py)
        val pw = w * 0.17f
        val ph = h * 0.30f
        rect.set(px - pw / 2f, py - ph / 2f, px + pw / 2f, py + ph / 2f)
        canvas.drawRoundRect(rect, dp(7f), dp(7f), phonePaint)
        canvas.drawCircle(px, py - ph / 2f + dp(8f), dp(2.5f), cameraPaint)
        canvas.restore()
    }

}
