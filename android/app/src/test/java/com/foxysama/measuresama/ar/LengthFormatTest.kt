package com.foxysama.measuresama.ar

import org.junit.Assert.assertEquals
import org.junit.Test

class LengthFormatTest {
    // Contract test vectors, shared with the web app's formatLength.
    @Test
    fun contractVectors() {
        assertEquals("12.3 cm", LengthFormat.format(0.1234, "cm"))
        assertEquals("1.23 m", LengthFormat.format(1.2345, "cm"))
        assertEquals("7.9 in", LengthFormat.format(0.2, "in"))
        assertEquals("1 ft 0.0 in", LengthFormat.format(0.3045, "in"))
        assertEquals("4 ft 0.6 in", LengthFormat.format(1.2345, "in"))
    }

    @Test
    fun metricSwitchesToMetresAtOneMetre() {
        assertEquals("99.9 cm", LengthFormat.format(0.999, "cm"))
        assertEquals("1.00 m", LengthFormat.format(1.0, "cm"))
        assertEquals("12.35 m", LengthFormat.format(12.345678, "cm"))
    }

    @Test
    fun metricRoundsLikeJavaScriptToFixed() {
        // 1.005 is stored as 1.00499999..., so toFixed(2) gives "1.00", not "1.01".
        assertEquals("1.00 m", LengthFormat.format(1.005, "cm"))
        assertEquals("0.5 cm", LengthFormat.format(0.005, "cm"))
    }

    @Test
    fun imperialBelowAFoot() {
        assertEquals("0.0 in", LengthFormat.format(0.0, "in"))
        assertEquals("1.0 in", LengthFormat.format(0.0254, "in"))
        assertEquals("11.9 in", LengthFormat.format(11.94 * 0.0254, "in"))
    }

    @Test
    fun imperialRoundsBeforeSplittingFeet() {
        // 11.96 in rounds to 12.0 in, so it is shown as a whole foot.
        assertEquals("1 ft 0.0 in", LengthFormat.format(11.96 * 0.0254, "in"))
        assertEquals("2 ft 11.9 in", LengthFormat.format(35.94 * 0.0254, "in"))
        assertEquals("3 ft 0.0 in", LengthFormat.format(36.0 * 0.0254, "in"))
    }

    @Test
    fun badInputShowsZero() {
        assertEquals("0.0 cm", LengthFormat.format(Double.NaN, "cm"))
        assertEquals("0.0 cm", LengthFormat.format(-1.0, "cm"))
        assertEquals("0.0 in", LengthFormat.format(Double.POSITIVE_INFINITY, "in"))
    }

    // Contract test vectors, shared with the web app's formatArea / formatVolume / formatAngle.
    @Test
    fun areaVolumeAngleContractVectors() {
        assertEquals("850 cm²", LengthFormat.area(0.085, "cm"))
        assertEquals("2.50 m²", LengthFormat.area(2.5, "cm"))
        assertEquals("26.91 sq ft", LengthFormat.area(2.5, "in"))
        assertEquals("250 L", LengthFormat.volume(0.25, "cm"))
        assertEquals("1.50 m³", LengthFormat.volume(1.5, "cm"))
        assertEquals("8.83 ft³", LengthFormat.volume(0.25, "in"))
        assertEquals("90.0°", LengthFormat.angle(90.0))
        assertEquals("45.0°", LengthFormat.angle(45.04))
    }

    @Test
    fun areaSwitchesUnitsAtOne() {
        assertEquals("9999 cm²", LengthFormat.area(0.9999, "cm"))
        assertEquals("1.00 m²", LengthFormat.area(1.0, "cm"))
        assertEquals("0 cm²", LengthFormat.area(0.0, "cm"))
        // Half a square centimetre rounds up, like Math.round.
        assertEquals("1 cm²", LengthFormat.area(0.00005, "cm"))
        // Just under a square foot (0.09290304 m²) is still square inches.
        assertEquals("144 sq in", LengthFormat.area(0.0929, "in"))
        assertEquals("1.00 sq ft", LengthFormat.area(0.09290304, "in"))
        assertEquals("96 sq in", LengthFormat.area(96 * 0.00064516, "in"))
    }

    @Test
    fun volumeSwitchesUnitsAtOne() {
        assertEquals("999 L", LengthFormat.volume(0.999, "cm"))
        assertEquals("1.00 m³", LengthFormat.volume(1.0, "cm"))
        assertEquals("1 L", LengthFormat.volume(0.0005, "cm"))
        assertEquals("1.00 ft³", LengthFormat.volume(0.028316846592, "in"))
        assertEquals("0.00 ft³", LengthFormat.volume(0.0, "in"))
    }

    @Test
    fun angleRoundsLikeToFixed() {
        assertEquals("180.0°", LengthFormat.angle(180.0))
        assertEquals("0.0°", LengthFormat.angle(0.0))
        assertEquals("33.3°", LengthFormat.angle(33.25)) // 33.25 is exact, so half-up
        assertEquals("12.3°", LengthFormat.angle(12.345))
    }

    @Test
    fun badAreaVolumeAngleShowZero() {
        assertEquals("0 cm²", LengthFormat.area(Double.NaN, "cm"))
        assertEquals("0 sq in", LengthFormat.area(-2.0, "in"))
        assertEquals("0 L", LengthFormat.volume(Double.POSITIVE_INFINITY, "cm"))
        assertEquals("0.00 ft³", LengthFormat.volume(-1.0, "in"))
        assertEquals("0.0°", LengthFormat.angle(Double.NaN))
        assertEquals("0.0°", LengthFormat.angle(-5.0))
    }
}
