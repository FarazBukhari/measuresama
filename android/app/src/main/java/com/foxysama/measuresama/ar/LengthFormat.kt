package com.foxysama.measuresama.ar

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Length labels for the AR screen. Must match the web app's formatLength exactly:
 * - cm: below 1 m "X.X cm", otherwise "X.XX m".
 * - in: round the total inches to 0.1 first; below 12 in "X.X in", otherwise "F ft R.R in".
 *
 * Rounding mirrors JavaScript: Number.toFixed (half-up on the exact double value) and
 * Math.round(inches * 10) / 10, with inches = metres / 0.0254.
 */
object LengthFormat {
    const val UNIT_CM = "cm"
    const val UNIT_IN = "in"

    private const val METRES_PER_INCH = 0.0254

    fun format(metres: Double, unit: String): String =
        if (unit == UNIT_IN) imperial(metres) else metric(metres)

    fun metric(metres: Double): String {
        val m = sanitize(metres)
        return if (m < 1.0) "${toFixed(m * 100, 1)} cm" else "${toFixed(m, 2)} m"
    }

    fun imperial(metres: Double): String {
        val tenths = Math.round(sanitize(metres) / METRES_PER_INCH * 10)
        if (tenths < 120) return "${tenths / 10}.${tenths % 10} in"
        val feet = tenths / 120
        val rest = tenths - feet * 120
        return "$feet ft ${rest / 10}.${rest % 10} in"
    }

    private fun sanitize(metres: Double): Double = if (metres.isFinite() && metres > 0) metres else 0.0

    private fun toFixed(value: Double, digits: Int): String =
        BigDecimal(value).setScale(digits, RoundingMode.HALF_UP).toPlainString()
}
