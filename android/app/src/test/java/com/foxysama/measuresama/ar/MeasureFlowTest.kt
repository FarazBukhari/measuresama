package com.foxysama.measuresama.ar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MeasureFlowTest {
    private val eps = 1e-4f

    private fun v(x: Float, y: Float, z: Float) = Vec3(x, y, z)

    private fun assertVec(expected: Vec3, actual: Vec3?) {
        assertNotNull(actual)
        assertEquals(expected.x, actual!!.x, eps)
        assertEquals(expected.y, actual.y, eps)
        assertEquals(expected.z, actual.z, eps)
    }

    private fun assertDoubles(expected: List<Double>, actual: List<Double>?) {
        assertNotNull(actual)
        assertEquals(expected.size, actual!!.size)
        expected.zip(actual).forEach { (e, a) -> assertEquals(e, a, 1e-5) }
    }

    private val floorRect = listOf(v(0f, 0f, 0f), v(2f, 0f, 0f), v(2f, 0f, 3f), v(0f, 0f, 3f))

    // ---- modes ----

    @Test
    fun modeIdsMatchTheContract() {
        assertEquals(
            listOf("distance", "path", "area", "angle", "height", "volume", "room-plan"),
            MeasureMode.entries.map { it.id },
        )
        assertEquals(MeasureMode.ROOM_PLAN, MeasureMode.fromId("room-plan"))
        assertEquals(MeasureMode.DISTANCE, MeasureMode.fromId("distance"))
        assertNull(MeasureMode.fromId("photo"))
        assertNull(MeasureMode.fromId(null))
    }

    // ---- distance ----

    @Test
    fun distanceFlow() {
        val f = MeasureFlow(MeasureMode.DISTANCE)
        assertEquals(AimKind.SURFACE, f.aimKind())
        assertEquals(ProgressKey.START, f.progressKey())
        assertFalse(f.canSave())
        assertNull(f.result())
        assertEquals(AddOutcome.ADDED, f.add(v(0f, 0f, 0f)))
        assertEquals(ProgressKey.END, f.progressKey())
        assertEquals(AddOutcome.ADDED, f.add(v(1f, 0f, 0f)))
        assertEquals(ProgressKey.DONE, f.progressKey())
        assertTrue(f.canSave())
        // Full: a tap moves B.
        assertEquals(AddOutcome.REPLACED_LAST, f.add(v(0f, 0f, 2f)))
        assertEquals(2, f.pointCount)
        val r = f.result()!!
        assertEquals(MeasureMode.DISTANCE, r.mode)
        assertEquals(2.0, r.distanceM!!, 1e-6)
        assertVec(v(0f, 0f, 2f), r.points[1])
        assertNull(r.segmentsM)
        assertNull(r.areaM2)
        assertNull(f.verticalBase())
    }

    @Test
    fun nonFinitePointsAreIgnored() {
        val f = MeasureFlow(MeasureMode.DISTANCE)
        assertEquals(AddOutcome.IGNORED, f.add(v(Float.NaN, 0f, 0f)))
        assertEquals(AddOutcome.IGNORED, f.add(v(0f, Float.POSITIVE_INFINITY, 0f)))
        assertEquals(0, f.pointCount)
    }

    // ---- path ----

    @Test
    fun pathFlowAndResult() {
        val f = MeasureFlow(MeasureMode.PATH)
        assertEquals(ProgressKey.START, f.progressKey())
        f.add(v(0f, 0f, 0f))
        assertEquals(ProgressKey.NEXT, f.progressKey())
        assertFalse(f.canSave())
        f.add(v(3f, 0f, 0f))
        assertTrue(f.canSave())
        assertEquals(ProgressKey.ADD_OR_SAVE, f.progressKey())
        f.add(v(3f, 0f, 4f))
        val r = f.result()!!
        assertDoubles(listOf(3.0, 4.0), r.segmentsM)
        assertEquals(7.0, r.distanceM!!, 1e-6)
        assertEquals(3, r.points.size)
        assertNull(r.perimeterM)
    }

    @Test
    fun pathStopsAtFiftyPoints() {
        val f = MeasureFlow(MeasureMode.PATH)
        repeat(MeasureFlow.MAX_POINTS) { assertEquals(AddOutcome.ADDED, f.add(v(it.toFloat(), 0f, 0f))) }
        assertEquals(AddOutcome.IGNORED, f.add(v(99f, 0f, 0f)))
        assertEquals(50, f.pointCount)
        assertEquals(ProgressKey.DONE, f.progressKey())
        assertNull(f.live(v(100f, 0f, 0f)).preview)
    }

    // ---- area ----

    @Test
    fun areaFlowAndResult() {
        val f = MeasureFlow(MeasureMode.AREA)
        assertEquals(AimKind.SURFACE, f.aimKind())
        assertEquals(ProgressKey.CORNER, f.progressKey())
        f.add(floorRect[0])
        f.add(floorRect[1])
        assertEquals(ProgressKey.NEXT_CORNER, f.progressKey())
        assertFalse(f.canSave())
        f.add(floorRect[2])
        assertTrue(f.canSave())
        assertEquals(ProgressKey.ADD_OR_SAVE, f.progressKey())
        f.add(floorRect[3])
        val r = f.result(v(0f, 1f, 0f))!!
        assertEquals(6.0, r.areaM2!!, 1e-5)
        assertEquals(10.0, r.perimeterM!!, 1e-5)
        assertEquals(10.0, r.distanceM!!, 1e-5)
        assertDoubles(listOf(2.0, 3.0, 2.0, 3.0), r.segmentsM)
        // Without a plane normal, the polygon's own plane is used.
        assertEquals(6.0, f.result()!!.areaM2!!, 1e-5)
    }

    @Test
    fun areaOnAWall() {
        val f = MeasureFlow(MeasureMode.AREA)
        listOf(v(1f, 0f, 0f), v(1f, 2f, 0f), v(1f, 2f, 3f), v(1f, 0f, 3f)).forEach { f.add(it) }
        assertEquals(6.0, f.result(v(-1f, 0f, 0f))!!.areaM2!!, 1e-5)
        assertEquals(6.0, f.live(null).value!!, 1e-5)
    }

    @Test
    fun areaLiveShowsTheClosingEdge() {
        val f = MeasureFlow(MeasureMode.AREA)
        floorRect.take(3).forEach { f.add(it) }
        val live = f.live(floorRect[3], v(0f, 1f, 0f))
        assertVec(floorRect[3], live.preview)
        assertFalse(live.replacesLast)
        assertEquals(4, live.segments.size)
        assertEquals(SegmentKind.CLOSING, live.segments.last().kind)
        assertTrue(live.segments.last().preview)
        assertFalse(live.segments.first().preview)
        assertEquals(6.0, live.value!!, 1e-5)
        assertEquals(ValueKind.AREA, live.valueKind)
        assertEquals(3, live.points.size)
    }

    // ---- angle ----

    @Test
    fun angleFlowAndResult() {
        val f = MeasureFlow(MeasureMode.ANGLE)
        assertEquals(ProgressKey.START, f.progressKey())
        f.add(v(1f, 0f, 0f))
        assertEquals(ProgressKey.VERTEX, f.progressKey())
        f.add(v(0f, 0f, 0f))
        assertEquals(ProgressKey.OTHER_END, f.progressKey())
        assertFalse(f.canSave())
        f.add(v(0f, 0f, 2f))
        assertEquals(ProgressKey.DONE, f.progressKey())
        var r = f.result()!!
        assertEquals(90.0, r.angleDeg!!, 1e-4)
        assertDoubles(listOf(1.0, 2.0), r.segmentsM)
        assertNull(r.distanceM)
        // Full: a tap moves the 3rd point.
        assertEquals(AddOutcome.REPLACED_LAST, f.add(v(1f, 0f, 1f)))
        assertEquals(3, f.pointCount)
        r = f.result()!!
        assertEquals(45.0, r.angleDeg!!, 1e-4)
    }

    @Test
    fun angleLiveValue() {
        val f = MeasureFlow(MeasureMode.ANGLE)
        f.add(v(1f, 0f, 0f))
        assertNull(f.live(v(0f, 0f, 0f)).value)
        f.add(v(0f, 0f, 0f))
        val live = f.live(v(-1f, 0f, 0f))
        assertEquals(180.0, live.value!!, 1e-4)
        assertEquals(ValueKind.ANGLE, live.valueKind)
        assertEquals(2, live.segments.size)
    }

    // ---- height ----

    @Test
    fun heightFlowAndResult() {
        val f = MeasureFlow(MeasureMode.HEIGHT)
        assertEquals(AimKind.FLOOR, f.aimKind())
        assertEquals(ProgressKey.BASE, f.progressKey())
        assertNull(f.verticalBase())
        f.add(v(0f, 0f, -2f))
        assertEquals(AimKind.VERTICAL, f.aimKind())
        assertVec(v(0f, 0f, -2f), f.verticalBase())
        assertEquals(ProgressKey.RAISE_TOP, f.progressKey())
        // The top is put exactly above the base.
        f.add(v(0.02f, 1.8f, -2.01f))
        assertTrue(f.canSave())
        assertVec(v(0f, 1.8f, -2f), f.points[1])
        assertEquals(AddOutcome.REPLACED_LAST, f.add(v(0f, 2.1f, -2f)))
        val r = f.result()!!
        assertEquals(2.1, r.heightM!!, 1e-5)
        assertEquals(2.1, r.distanceM!!, 1e-5)
        assertEquals(2, r.points.size)
    }

    @Test
    fun heightTopNeverGoesBelowTheBase() {
        val f = MeasureFlow(MeasureMode.HEIGHT)
        f.add(v(0f, 0.5f, 0f))
        f.add(v(0f, -1f, 0f))
        assertVec(v(0f, 0.5f, 0f), f.points[1])
    }

    @Test
    fun heightLiveIsVertical() {
        val f = MeasureFlow(MeasureMode.HEIGHT)
        assertTrue(f.live(v(0f, 0f, 0f)).segments.isEmpty())
        f.add(v(0f, 0f, 0f))
        val live = f.live(v(0.1f, 1.2f, 0f))
        assertVec(v(0f, 1.2f, 0f), live.preview)
        assertEquals(1, live.segments.size)
        assertEquals(SegmentKind.VERTICAL, live.segments[0].kind)
        assertEquals(1.2, live.value!!, 1e-5)
    }

    // ---- volume ----

    @Test
    fun volumeFlowAndResult() {
        val f = MeasureFlow(MeasureMode.VOLUME)
        assertEquals(AimKind.FLOOR, f.aimKind())
        assertEquals(ProgressKey.CORNER, f.progressKey())
        f.add(v(0f, 0f, 0f))
        f.add(v(1f, 0f, 0f))
        assertEquals(ProgressKey.NEXT_CORNER, f.progressKey())
        assertEquals(AimKind.FLOOR, f.aimKind())
        // The 3rd corner is stored square to the first edge.
        f.add(v(1.2f, 0.03f, 0.5f))
        assertVec(v(1f, 0f, 0.5f), f.points[2])
        assertEquals(AimKind.VERTICAL, f.aimKind())
        assertVec(v(1f, 0f, 0.5f), f.verticalBase())
        assertEquals(ProgressKey.RAISE_TOP, f.progressKey())
        assertFalse(f.canSave())
        f.add(v(1f, 1.5f, 0.5f))
        assertEquals(ProgressKey.DONE, f.progressKey())
        assertEquals(AddOutcome.REPLACED_LAST, f.add(v(1.1f, 2f, 0.5f)))
        assertEquals(4, f.pointCount)
        val r = f.result()!!
        assertEquals(1.0, r.lengthM!!, 1e-5)
        assertEquals(0.5, r.widthM!!, 1e-5)
        assertEquals(2.0, r.heightM!!, 1e-5)
        assertEquals(0.5, r.areaM2!!, 1e-5)
        assertEquals(1.0, r.volumeM3!!, 1e-5)
        assertNull(r.distanceM)
        assertVec(v(1f, 2f, 0.5f), r.points[3])
    }

    @Test
    fun volumeLiveValueKinds() {
        val f = MeasureFlow(MeasureMode.VOLUME)
        f.add(v(0f, 0f, 0f))
        assertEquals(ValueKind.LENGTH, f.live(v(1f, 0f, 0f)).valueKind)
        f.add(v(1f, 0f, 0f))
        val base = f.live(v(1f, 0f, 0.5f))
        assertEquals(ValueKind.AREA, base.valueKind)
        assertEquals(0.5, base.value!!, 1e-5)
        f.add(v(1f, 0f, 0.5f))
        val box = f.live(v(1f, 2f, 0.5f))
        assertEquals(ValueKind.VOLUME, box.valueKind)
        assertEquals(1.0, box.value!!, 1e-5)
        assertEquals(SegmentKind.VERTICAL, box.segments.last().kind)
        assertEquals(3, box.segments.size)
    }

    // ---- room plan ----

    private fun roomWithCorners(n: Int = 4) = MeasureFlow(MeasureMode.ROOM_PLAN).also { f ->
        floorRect.take(n).forEach { f.add(it) }
    }

    @Test
    fun roomPlanOpenCanSave() {
        val f = MeasureFlow(MeasureMode.ROOM_PLAN)
        assertEquals(AimKind.FLOOR, f.aimKind())
        assertEquals(ProgressKey.CORNER, f.progressKey())
        f.add(floorRect[0])
        f.add(floorRect[1])
        assertEquals(ProgressKey.NEXT_CORNER, f.progressKey())
        assertFalse(f.canSave())
        f.add(floorRect[2])
        f.add(floorRect[3])
        assertEquals(ProgressKey.CLOSE_OR_SAVE, f.progressKey())
        assertTrue(f.canSave())
        val r = f.result()!!
        assertEquals(6.0, r.areaM2!!, 1e-5)
        assertEquals(10.0, r.perimeterM!!, 1e-5)
        assertEquals(10.0, r.distanceM!!, 1e-5)
        assertDoubles(listOf(2.0, 3.0, 2.0, 3.0), r.segmentsM)
        assertNull(r.wallHeightM)
    }

    @Test
    fun roomPlanCloseAndWallHeight() {
        val f = roomWithCorners()
        assertEquals(AddOutcome.CLOSED, f.add(v(0.01f, 0f, 0.01f), nearFirst = true))
        assertTrue(f.closed)
        assertEquals(4, f.pointCount)
        assertEquals(AimKind.VERTICAL, f.aimKind())
        assertVec(floorRect[0], f.verticalBase())
        assertEquals(ProgressKey.WALL_HEIGHT, f.progressKey())
        assertTrue(f.canSave())
        assertNull(f.result()!!.wallHeightM)

        assertEquals(AddOutcome.ADDED, f.add(v(0.1f, 2.4f, 0f)))
        assertVec(v(0f, 2.4f, 0f), f.wallTop)
        assertEquals(ProgressKey.DONE, f.progressKey())
        assertEquals(AddOutcome.REPLACED_LAST, f.add(v(0f, 2.5f, 0f)))
        val r = f.result()!!
        assertEquals(2.5, r.wallHeightM!!, 1e-5)
        assertEquals(6.0, r.areaM2!!, 1e-5)
        assertEquals(4, r.points.size)
    }

    @Test
    fun roomPlanCloseNeedsThreeCorners() {
        val f = roomWithCorners(2)
        assertFalse(f.close())
        // nearFirst with too few corners just adds a corner.
        assertEquals(AddOutcome.ADDED, f.add(floorRect[2], nearFirst = true))
        assertFalse(f.closed)
        assertTrue(f.close())
        assertFalse(f.close())
        assertFalse(MeasureFlow(MeasureMode.AREA).also { a -> floorRect.forEach { a.add(it) } }.close())
    }

    @Test
    fun roomPlanUndoWalksBackThroughThePhases() {
        val f = roomWithCorners()
        f.close()
        f.add(v(0f, 2.4f, 0f))
        assertTrue(f.undo())
        assertNull(f.wallTop)
        assertTrue(f.closed)
        assertTrue(f.undo())
        assertFalse(f.closed)
        assertEquals(4, f.pointCount)
        assertEquals(AimKind.FLOOR, f.aimKind())
        assertTrue(f.undo())
        assertEquals(3, f.pointCount)
        repeat(3) { assertTrue(f.undo()) }
        assertFalse(f.undo())
        assertEquals(ProgressKey.CORNER, f.progressKey())
    }

    @Test
    fun roomPlanCanClose() {
        val f = roomWithCorners(3)
        val first = ScreenPoint(100f, 100f)
        assertTrue(f.canClose(ScreenPoint(110f, 105f), first, 30f))
        assertFalse(f.canClose(ScreenPoint(200f, 100f), first, 30f))
        assertFalse(f.canClose(null, first, 30f))
        assertFalse(f.canClose(ScreenPoint(100f, 100f), null, 30f))
        assertFalse(roomWithCorners(2).canClose(first, first, 30f))
        f.close()
        assertFalse(f.canClose(first, first, 30f))
        assertFalse(MeasureFlow(MeasureMode.AREA).also { a -> floorRect.forEach { a.add(it) } }.canClose(first, first, 30f))
    }

    @Test
    fun roomPlanCap() {
        val f = MeasureFlow(MeasureMode.ROOM_PLAN)
        repeat(MeasureFlow.MAX_POINTS) { f.add(v(it.toFloat(), 0f, (it % 2).toFloat())) }
        assertEquals(AddOutcome.IGNORED, f.add(v(0f, 0f, 5f)))
        // A full room can still be closed.
        assertEquals(AddOutcome.CLOSED, f.add(v(0f, 0f, 0f), nearFirst = true))
    }

    @Test
    fun roomPlanLiveAfterClosing() {
        val f = roomWithCorners()
        f.close()
        val live = f.live(v(0f, 2f, 0f))
        assertEquals(5, live.segments.size)
        assertEquals(SegmentKind.CLOSING, live.segments[3].kind)
        assertEquals(SegmentKind.VERTICAL, live.segments[4].kind)
        assertEquals(2.0, live.segments[4].lengthM, 1e-5)
        assertTrue(live.segments[4].preview)
        assertFalse(live.replacesLast)
        assertEquals(6.0, live.value!!, 1e-5)
        assertEquals(ValueKind.AREA, live.valueKind)
        // With the wall top placed and no aim, the vertical line stays, not as a preview.
        f.add(v(0f, 2.4f, 0f))
        val placed = f.live(null)
        assertNull(placed.preview)
        assertVec(v(0f, 2.4f, 0f), placed.wallTop)
        assertFalse(placed.segments.last().preview)
        assertTrue(f.live(v(0f, 2.6f, 0f)).replacesLast)
    }

    // ---- common ----

    @Test
    fun undoAndClear() {
        val f = MeasureFlow(MeasureMode.PATH)
        assertFalse(f.undo())
        f.add(v(0f, 0f, 0f))
        f.add(v(1f, 0f, 0f))
        assertTrue(f.undo())
        assertEquals(1, f.pointCount)
        f.add(v(2f, 0f, 0f))
        f.clear()
        assertEquals(0, f.pointCount)
        assertEquals(ProgressKey.START, f.progressKey())

        val room = roomWithCorners()
        room.close()
        room.add(v(0f, 2f, 0f))
        room.clear()
        assertFalse(room.closed)
        assertNull(room.wallTop)
        assertEquals(0, room.pointCount)
    }

    @Test
    fun liveDistancePreviewFollowsTheAim() {
        val f = MeasureFlow(MeasureMode.DISTANCE)
        val empty = f.live(v(0f, 0f, 0f))
        assertNull(empty.value)
        assertTrue(empty.segments.isEmpty())
        f.add(v(0f, 0f, 0f))
        val one = f.live(v(0f, 0f, 1.5f))
        assertEquals(1.5, one.value!!, 1e-5)
        assertEquals(ValueKind.LENGTH, one.valueKind)
        assertTrue(one.segments.single().preview)
        f.add(v(0f, 0f, 1.5f))
        // Full: the preview would move B.
        val full = f.live(v(0f, 0f, 2f))
        assertTrue(full.replacesLast)
        assertEquals(2.0, full.value!!, 1e-5)
        // No aim: just the placed line.
        val still = f.live(null)
        assertNull(still.preview)
        assertEquals(1.5, still.value!!, 1e-5)
        assertFalse(still.segments.single().preview)
        assertNull(f.live(v(Float.NaN, 0f, 0f)).preview)
    }

    @Test
    fun canSaveThresholds() {
        val needed = mapOf(
            MeasureMode.DISTANCE to 2, MeasureMode.PATH to 2, MeasureMode.AREA to 3, MeasureMode.ANGLE to 3,
            MeasureMode.HEIGHT to 2, MeasureMode.VOLUME to 4, MeasureMode.ROOM_PLAN to 3,
        )
        for ((mode, n) in needed) {
            val f = MeasureFlow(mode)
            for (i in 0 until n) {
                assertFalse("$mode with $i points", f.canSave())
                assertNull(f.result())
                // Corners of a 1 m square on the floor, then a top 1 m up.
                f.add(listOf(v(0f, 0f, 0f), v(1f, 0f, 0f), v(1f, 0f, 1f), v(1f, 1f, 1f))[i])
            }
            assertTrue("$mode with $n points", f.canSave())
            assertEquals(mode, f.result()!!.mode)
        }
    }
}
