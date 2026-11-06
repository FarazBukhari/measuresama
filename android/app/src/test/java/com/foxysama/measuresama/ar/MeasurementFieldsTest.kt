package com.foxysama.measuresama.ar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

/** The ArMeasurement fields per mode must match src/plugins/ar-measure/definitions.ts exactly. */
class MeasurementFieldsTest {
    private fun v(x: Float, y: Float, z: Float) = Vec3(x, y, z)

    private fun keys(flow: MeasureFlow, normal: Vec3? = null): List<String> {
        val result = flow.result(normal)
        assertNotNull(result)
        return MeasurementFields.of(result!!).map { it.first }
    }

    private fun flowWith(mode: MeasureMode, vararg points: Vec3): MeasureFlow {
        val flow = MeasureFlow(mode)
        points.forEach { flow.add(it) }
        return flow
    }

    @Test
    fun distanceFieldsAreUnchanged() {
        val flow = flowWith(MeasureMode.DISTANCE, v(0f, 0f, 0f), v(1.234567f, 0f, 0f))
        val fields = MeasurementFields.of(flow.result()!!)
        assertEquals(listOf("distanceM"), fields.map { it.first })
        assertEquals(1.23457, fields[0].second as Double, 0.0)
    }

    @Test
    fun pathFields() {
        val flow = flowWith(MeasureMode.PATH, v(0f, 0f, 0f), v(1f, 0f, 0f), v(1f, 0f, 2f))
        val fields = MeasurementFields.of(flow.result()!!).toMap()
        assertEquals(setOf("distanceM", "segmentsM"), fields.keys)
        assertEquals(listOf(1.0, 2.0), fields["segmentsM"])
        assertEquals(3.0, fields["distanceM"] as Double, 1e-9)
    }

    @Test
    fun areaFields() {
        val flow = flowWith(MeasureMode.AREA, v(0f, 0f, 0f), v(2f, 0f, 0f), v(2f, 0f, 3f), v(0f, 0f, 3f))
        val fields = MeasurementFields.of(flow.result(MeasureMath.UP)!!).toMap()
        assertEquals(setOf("distanceM", "segmentsM", "perimeterM", "areaM2"), fields.keys)
        assertEquals(6.0, fields["areaM2"] as Double, 1e-5)
        assertEquals(10.0, fields["perimeterM"] as Double, 1e-5)
        assertEquals(fields["perimeterM"], fields["distanceM"])
        assertEquals(4, (fields["segmentsM"] as List<*>).size)
    }

    @Test
    fun angleFieldsRoundTheAngleToThreeDecimals() {
        val flow = flowWith(MeasureMode.ANGLE, v(1f, 0f, 0f), v(0f, 0f, 0f), v(1f, 0f, 1f))
        val fields = MeasurementFields.of(flow.result()!!)
        assertEquals(listOf("segmentsM", "angleDeg"), fields.map { it.first })
        assertEquals(45.0, fields.toMap()["angleDeg"] as Double, 0.0)
        assertEquals(0.123, MeasurementFields.round3(0.12345), 0.0)
    }

    @Test
    fun heightFields() {
        val flow = flowWith(MeasureMode.HEIGHT, v(0f, 0f, 0f), v(0.3f, 1.5f, 0f))
        val fields = MeasurementFields.of(flow.result()!!).toMap()
        assertEquals(setOf("distanceM", "heightM"), fields.keys)
        assertEquals(1.5, fields["heightM"] as Double, 1e-5)
    }

    @Test
    fun volumeFields() {
        val flow = flowWith(MeasureMode.VOLUME, v(0f, 0f, 0f), v(2f, 0f, 0f), v(2f, 0f, 1f), v(2f, 0.5f, 1f))
        val fields = MeasurementFields.of(flow.result()!!).toMap()
        assertEquals(setOf("lengthM", "widthM", "heightM", "areaM2", "volumeM3"), fields.keys)
        assertEquals(1.0, fields["volumeM3"] as Double, 1e-5)
    }

    @Test
    fun roomPlanFieldsWithAndWithoutWallHeight() {
        val flow = flowWith(MeasureMode.ROOM_PLAN, v(0f, 0f, 0f), v(4f, 0f, 0f), v(4f, 0f, 3f), v(0f, 0f, 3f))
        assertEquals(setOf("distanceM", "segmentsM", "perimeterM", "areaM2"), keys(flow).toSet())
        flow.close()
        flow.add(v(0f, 2.5f, 0f))
        val fields = MeasurementFields.of(flow.result()!!).toMap()
        assertEquals(setOf("distanceM", "segmentsM", "perimeterM", "areaM2", "wallHeightM"), fields.keys)
        assertEquals(2.5, fields["wallHeightM"] as Double, 1e-5)
        assertEquals(12.0, fields["areaM2"] as Double, 1e-5)
    }

    @Test
    fun pointsRoundToFiveDecimals() {
        val xyz = MeasurementFields.point(v(0.1234567f, -1.000004f, 2f))
        assertEquals(0.12346, xyz[0], 0.0)
        assertEquals(-1.0, xyz[1], 0.0)
        assertEquals(2.0, xyz[2], 0.0)
    }
}
