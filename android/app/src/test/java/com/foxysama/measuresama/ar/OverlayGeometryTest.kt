package com.foxysama.measuresama.ar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OverlayGeometryTest {
    private val eps = 1e-4f

    @Test
    fun boxCornersBuildTheFloorRectangleAndTop() {
        val a = Vec3(0f, 0f, 0f)
        val b = Vec3(2f, 0f, 0f)
        val c = Vec3(2f, 0f, 1f)
        val t = Vec3(2f, 0.5f, 1f)
        assertEquals(listOf(a, b), OverlayGeometry.boxCorners(listOf(a, b)))
        val base = OverlayGeometry.boxCorners(listOf(a, b, c))
        assertEquals(4, base.size)
        assertEquals(Vec3(0f, 0f, 1f), base[3])
        val box = OverlayGeometry.boxCorners(listOf(a, b, c, t))
        assertEquals(8, box.size)
        assertEquals(Vec3(0f, 0.5f, 0f), box[4])
        assertEquals(t, box[6])
    }

    @Test
    fun boxEdgeCounts() {
        assertEquals(0, OverlayGeometry.boxEdges(1).size)
        assertEquals(1, OverlayGeometry.boxEdges(2).size)
        assertEquals(4, OverlayGeometry.boxEdges(4).size)
        val edges = OverlayGeometry.boxEdges(8)
        assertEquals(12, edges.size)
        assertEquals(12, edges.toSet().size)
        edges.forEach { (i, j) -> assert(i in 0..7 && j in 0..7 && i != j) }
    }

    @Test
    fun centroid() {
        assertNull(OverlayGeometry.centroid(emptyList()))
        val c = OverlayGeometry.centroid(listOf(ScreenPoint(0f, 0f), ScreenPoint(4f, 0f), ScreenPoint(4f, 2f), ScreenPoint(0f, 2f)))!!
        assertEquals(2f, c.x, eps)
        assertEquals(1f, c.y, eps)
    }

    @Test
    fun angleArcTakesTheShortWayRound() {
        val v = ScreenPoint(100f, 100f)
        // Right, then down (screen y grows down): +90 degrees clockwise.
        val arc = OverlayGeometry.angleArc(v, ScreenPoint(200f, 100f), ScreenPoint(100f, 200f))!!
        assertEquals(0f, arc.startDeg, eps)
        assertEquals(90f, arc.sweepDeg, eps)
        // From just above the left edge to just below it: a short sweep across 180 degrees.
        val wrap = OverlayGeometry.angleArc(v, ScreenPoint(0f, 90f), ScreenPoint(0f, 110f))!!
        assertEquals(-11.42f, wrap.sweepDeg, 0.01f)
        val label = OverlayGeometry.arcLabelPoint(arc, 10f)
        assertEquals(100f + 7.0711f, label.x, 1e-3f)
        assertEquals(100f + 7.0711f, label.y, 1e-3f)
    }

    @Test
    fun angleArcNeedsTwoArms() {
        val v = ScreenPoint(10f, 10f)
        assertNull(OverlayGeometry.angleArc(v, v, ScreenPoint(20f, 10f)))
    }
}
