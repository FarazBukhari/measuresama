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
}
