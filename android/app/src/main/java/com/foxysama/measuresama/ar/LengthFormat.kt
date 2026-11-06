package com.foxysama.measuresama.ar

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Labels for the AR screen. Must match the web app's formatLength / formatArea / formatVolume /
 * formatAngle (src/lib/units.ts) exactly:
 * - length cm: below 1 m "X.X cm", otherwise "X.XX m".
 * - length in: round the total inches to 0.1 first; below 12 in "X.X in", otherwise "F ft R.R in".
 * - area cm: below 1 m² "N cm²", otherwise "X.XX m²"; in: below 1 sq ft "N sq in", otherwise "X.XX sq ft".
 * - volume cm: below 1 m³ "N L", otherwise "X.XX m³"; in: "X.XX ft³".
 * - angle: "X.X°".
 *
 * Rounding mirrors JavaScript: Number.toFixed (half-up on the exact double value) and
 * Math.round (half-up for the non-negative values used here). Invalid values (NaN, infinite,
 * negative) are shown as 0, where the web shows a dash.
 */
object LengthFormat {
    const val UNIT_CM = "cm"
    const val UNIT_IN = "in"

    private const val METRES_PER_INCH = 0.0254
    private const val SQ_METRES_PER_SQ_FOOT = 0.09290304
    private const val SQ_METRES_PER_SQ_INCH = 0.00064516
    private const val CUBIC_METRES_PER_CUBIC_FOOT = 0.028316846592

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

    /** Area label for [m2] square metres, e.g. "850 cm²", "2.50 m²", "96 sq in", "26.91 sq ft". */
    fun area(m2: Double, unit: String): String {
        val a = sanitize(m2)
        if (unit == UNIT_IN) {
            val sqFt = a / SQ_METRES_PER_SQ_FOOT
            return if (sqFt < 1.0) "${Math.round(a / SQ_METRES_PER_SQ_INCH)} sq in" else "${toFixed(sqFt, 2)} sq ft"
        }
        return if (a < 1.0) "${Math.round(a * 10_000)} cm²" else "${toFixed(a, 2)} m²"
    }

    /** Volume label for [m3] cubic metres, e.g. "250 L", "1.50 m³", "8.83 ft³". */
    fun volume(m3: Double, unit: String): String {
        val v = sanitize(m3)
        if (unit == UNIT_IN) return "${toFixed(v / CUBIC_METRES_PER_CUBIC_FOOT, 2)} ft³"
        return if (v < 1.0) "${Math.round(v * 1000)} L" else "${toFixed(v, 2)} m³"
    }

    /** Angle label to one decimal, e.g. "90.0°". */
    fun angle(deg: Double): String = "${toFixed(sanitize(deg), 1)}°"

    private fun sanitize(metres: Double): Double = if (metres.isFinite() && metres > 0) metres else 0.0

    private fun toFixed(value: Double, digits: Int): String =
        BigDecimal(value).setScale(digits, RoundingMode.HALF_UP).toPlainString()
}
