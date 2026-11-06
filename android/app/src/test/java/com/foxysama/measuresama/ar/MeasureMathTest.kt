package com.foxysama.measuresama.ar

import kotlin.math.sqrt
import kotlin.math.tan
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MeasureMathTest {
    private val eps = 1e-4f

    private fun assertVec(expected: Vec3, actual: Vec3?, tolerance: Float = eps) {
        assertNotNull(actual)
        assertEquals(expected.x, actual!!.x, tolerance)
        assertEquals(expected.y, actual.y, tolerance)
        assertEquals(expected.z, actual.z, tolerance)
    }

    /** Column-major OpenGL perspective matrix, as ARCore's Camera.getProjectionMatrix returns. */
    private fun perspective(fovYDeg: Float, aspect: Float, near: Float, far: Float): FloatArray {
        val f = 1f / tan(Math.toRadians(fovYDeg / 2.0)).toFloat()
        val m = FloatArray(16)
        m[0] = f / aspect
        m[5] = f
        m[10] = (far + near) / (near - far)
        m[11] = -1f
        m[14] = 2f * far * near / (near - far)
        return m
    }

    private fun identity() = FloatArray(16).also { it[0] = 1f; it[5] = 1f; it[10] = 1f; it[15] = 1f }

    private fun translation(x: Float, y: Float, z: Float) = identity().also { it[12] = x; it[13] = y; it[14] = z }

    // ---- ray / plane ----

    @Test
    fun rayHitsPlaneInFront() {
        // Camera 1.5 m above the floor, looking straight down.
        val ray = Ray(Vec3(0f, 1.5f, 0f), Vec3(0f, -1f, 0f))
        val hit = MeasureMath.intersectRayPlane(ray, Vec3(2f, 0f, -3f), Vec3(0f, 1f, 0f))
        assertVec(Vec3(0f, 0f, 0f), hit)
    }

    @Test
    fun rayHitsPlaneAtAnAngle() {
        val dir = Vec3(0f, -1f, -1f).normalized()
        val hit = MeasureMath.intersectRayPlane(Ray(Vec3(0f, 1f, 0f), dir), Vec3(0f, 0f, 0f), Vec3(0f, 1f, 0f))
        assertVec(Vec3(0f, 0f, -1f), hit)
    }

    @Test
    fun rayParallelToPlaneMisses() {
        val ray = Ray(Vec3(0f, 1f, 0f), Vec3(1f, 0f, 0f))
        assertNull(MeasureMath.intersectRayPlane(ray, Vec3(0f, 0f, 0f), Vec3(0f, 1f, 0f)))
    }

    @Test
    fun planeBehindRayMisses() {
        // Looking up, away from the floor.
        val ray = Ray(Vec3(0f, 1f, 0f), Vec3(0f, 1f, 0f))
        assertNull(MeasureMath.intersectRayPlane(ray, Vec3(0f, 0f, 0f), Vec3(0f, 1f, 0f)))
    }

    @Test
    fun hitBeyondMaxDistanceMisses() {
        val dir = Vec3(1f, -0.001f, 0f).normalized()
        assertNull(MeasureMath.intersectRayPlane(Ray(Vec3(0f, 1f, 0f), dir), Vec3(0f, 0f, 0f), Vec3(0f, 1f, 0f)))
    }

    @Test
    fun signedDistanceSaysWhichSideOfThePlane() {
        val normal = Vec3(0f, 2f, 0f) // not normalised on purpose
        assertEquals(1.5f, MeasureMath.signedDistanceToPlane(Vec3(3f, 1.5f, 0f), Vec3(0f, 0f, 0f), normal), eps)
        assertEquals(-0.5f, MeasureMath.signedDistanceToPlane(Vec3(0f, -0.5f, 9f), Vec3(0f, 0f, 0f), normal), eps)
    }

    // ---- matrices ----

    @Test
    fun inverseTimesMatrixIsIdentity() {
        val m = MeasureMath.multiply(perspective(60f, 0.5f, 0.1f, 100f), translation(0.3f, -1.2f, 2f))
        val inv = MeasureMath.invert(m)
        assertNotNull(inv)
        val product = MeasureMath.multiply(m, inv!!)
        val expected = identity()
        for (i in 0 until 16) assertEquals("element $i", expected[i], product[i], 1e-4f)
    }

    @Test
    fun singularMatrixHasNoInverse() {
        assertNull(MeasureMath.invert(FloatArray(16)))
    }

    // ---- projection ----

    @Test
    fun pointStraightAheadProjectsToScreenCentre() {
        val p = MeasureMath.projectToScreen(perspective(90f, 1f, 0.1f, 100f), Vec3(0f, 0f, -2f), 1000, 1000)
        assertNotNull(p)
        assertEquals(500f, p!!.x, 0.01f)
        assertEquals(500f, p.y, 0.01f)
    }

    @Test
    fun pointsProjectRightAndUpOnScreen() {
        // 90 degree field of view, square view: x = z maps to the right edge's midpoint.
        val vp = perspective(90f, 1f, 0.1f, 100f)
        val right = MeasureMath.projectToScreen(vp, Vec3(1f, 0f, -2f), 1000, 1000)!!
        assertEquals(750f, right.x, 0.01f)
        assertEquals(500f, right.y, 0.01f)
        // World up is screen up: smaller y.
        val up = MeasureMath.projectToScreen(vp, Vec3(0f, 1f, -2f), 1000, 1000)!!
        assertEquals(500f, up.x, 0.01f)
        assertEquals(250f, up.y, 0.01f)
    }

    @Test
    fun pointBehindCameraIsNotProjected() {
        assertNull(MeasureMath.projectToScreen(perspective(90f, 1f, 0.1f, 100f), Vec3(0f, 0f, 2f), 1000, 1000))
    }

    @Test
    fun viewMatrixIsApplied() {
        // Camera moved 1 m right (view = inverse of camera pose): a point at x = 1 is dead ahead.
        val vp = MeasureMath.multiply(perspective(90f, 1f, 0.1f, 100f), translation(-1f, 0f, 0f))
        val p = MeasureMath.projectToScreen(vp, Vec3(1f, 0f, -3f), 800, 600)!!
        assertEquals(400f, p.x, 0.01f)
        assertEquals(300f, p.y, 0.01f)
    }

    @Test
    fun segmentCrossingBehindCameraIsClipped() {
        val vp = perspective(90f, 1f, 0.1f, 100f)
        val seg = MeasureMath.projectSegment(vp, Vec3(1f, 0f, -2f), Vec3(1f, 0f, 2f), 1000, 1000)
        assertNotNull(seg)
        assertEquals(750f, seg!!.start.x, 0.01f)
        // The clipped end lies on the near plane, further right than the visible end.
        assertTrue(seg.end.x > seg.start.x)
        assertTrue(seg.end.x.isFinite() && seg.end.y.isFinite())
    }

    @Test
    fun segmentFullyBehindCameraIsDropped() {
        val vp = perspective(90f, 1f, 0.1f, 100f)
        assertNull(MeasureMath.projectSegment(vp, Vec3(0f, 0f, 1f), Vec3(1f, 0f, 3f), 1000, 1000))
    }

    @Test
    fun segmentInFrontIsUnchanged() {
        val vp = perspective(90f, 1f, 0.1f, 100f)
        val seg = MeasureMath.projectSegment(vp, Vec3(0f, 0f, -2f), Vec3(1f, 0f, -2f), 1000, 1000)!!
        assertEquals(500f, seg.start.x, 0.01f)
        assertEquals(750f, seg.end.x, 0.01f)
        assertEquals(625f, seg.midpoint.x, 0.01f)
    }

    @Test
    fun screenRayGoesBackThroughTheProjectedPoint() {
        val vp = MeasureMath.multiply(perspective(70f, 0.6f, 0.1f, 100f), translation(0.2f, -1.4f, 0.5f))
        val inv = MeasureMath.invert(vp)!!
        val world = Vec3(0.4f, 0.1f, -2.5f)
        val screen = MeasureMath.projectToScreen(vp, world, 1080, 1800)!!
        val (nx, ny) = MeasureMath.screenToNdc(screen.x, screen.y, 1080, 1800)
        val ray = MeasureMath.screenRay(inv, nx, ny)
        assertNotNull(ray)
        assertEquals(1f, ray!!.direction.length(), 1e-4f)
        // The point lies on the ray: distance from it to the ray is ~0.
        val toPoint = world - ray.origin
        val along = toPoint.dot(ray.direction)
        assertTrue(along > 0f)
        val closest = ray.origin + ray.direction * along
        assertEquals(0f, (world - closest).length(), 1e-3f)
    }

    @Test
    fun levelCentreRayMissesTheFloorButALowerRayHitsIt() {
        // Camera at 1.5 m, no rotation: the centre ray looks along -z and misses the floor.
        val proj = perspective(60f, 0.5f, MeasureMath.NEAR, MeasureMath.FAR)
        val level = MeasureMath.invert(MeasureMath.multiply(proj, translation(0f, -1.5f, 0f)))!!
        val levelRay = MeasureMath.screenRay(level, 0f, 0f)!!
        assertVec(Vec3(0f, 0f, -1f), levelRay.direction)
        assertNull(MeasureMath.intersectRayPlane(levelRay, Vec3(0f, 0f, 0f), Vec3(0f, 1f, 0f)))

        // Lower part of the screen (ndc y < 0) points down and reaches the floor ahead.
        val down = MeasureMath.screenRay(level, 0f, -0.5f)!!
        val hit = MeasureMath.intersectRayPlane(down, Vec3(0f, 0f, 0f), Vec3(0f, 1f, 0f))
        assertNotNull(hit)
        assertEquals(0f, hit!!.y, 1e-3f)
        assertTrue(hit.z < 0f)
    }

    // ---- distance and smoothing ----

    @Test
    fun distanceIsEuclidean() {
        assertEquals(5.0, MeasureMath.distance(Vec3(0f, 0f, 0f), Vec3(3f, 4f, 0f)), 1e-6)
        assertEquals(sqrt(3.0), MeasureMath.distance(Vec3(1f, 1f, 1f), Vec3(2f, 2f, 2f)), 1e-6)
        assertEquals(0.0, MeasureMath.distance(Vec3(1f, 2f, 3f), Vec3(1f, 2f, 3f)), 0.0)
    }

    @Test
    fun lowPassJumpsToFirstValue() {
        assertVec(Vec3(1f, 2f, 3f), MeasureMath.lowPass(null, Vec3(1f, 2f, 3f)))
    }

    @Test
    fun lowPassMovesPartWayEachFrame() {
        val next = MeasureMath.lowPass(Vec3(0f, 0f, 0f), Vec3(1f, 0f, -2f))
        assertVec(Vec3(0.35f, 0f, -0.7f), next)
    }

    @Test
    fun lowPassConvergesOnAStillTarget() {
        var p: Vec3? = Vec3(0f, 0f, 0f)
        val target = Vec3(1f, 1f, 1f)
        repeat(30) { p = MeasureMath.lowPass(p, target) }
        assertVec(target, p, 1e-3f)
    }
}
