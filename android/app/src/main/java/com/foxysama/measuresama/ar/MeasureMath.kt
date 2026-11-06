package com.foxysama.measuresama.ar

import kotlin.math.abs
import kotlin.math.sqrt

/** A point or direction in AR world space, in metres. */
data class Vec3(val x: Float, val y: Float, val z: Float) {
    operator fun plus(o: Vec3) = Vec3(x + o.x, y + o.y, z + o.z)

    operator fun minus(o: Vec3) = Vec3(x - o.x, y - o.y, z - o.z)

    operator fun times(s: Float) = Vec3(x * s, y * s, z * s)

    fun dot(o: Vec3): Float = x * o.x + y * o.y + z * o.z

    fun length(): Float = sqrt(dot(this))

    fun normalized(): Vec3 {
        val len = length()
        return if (len > 0f) this * (1f / len) else this
    }

    companion object {
        fun of(values: FloatArray) = Vec3(values[0], values[1], values[2])
    }
}

/** A ray in world space. [direction] is normalised. */
data class Ray(val origin: Vec3, val direction: Vec3)

/** A position on the screen, in view pixels (origin top-left). */
data class ScreenPoint(val x: Float, val y: Float)

/** A line on the screen, already clipped to the camera's near plane. */
data class ScreenSegment(val start: ScreenPoint, val end: ScreenPoint) {
    val midpoint: ScreenPoint get() = ScreenPoint((start.x + end.x) / 2f, (start.y + end.y) / 2f)
}

/**
 * Pure geometry for the AR measuring screen. Matrices are 4x4, column-major (OpenGL / ARCore layout).
 * No Android or ARCore types here, so all of it runs in plain JUnit tests.
 */
object MeasureMath {
    /** Near and far clip planes for the camera projection, in metres. */
    const val NEAR = 0.1f
    const val FAR = 100f

    /** Low-pass factor for the aimed point: how far it moves towards the new value each frame. */
    const val SMOOTHING = 0.35f

    /** Beyond this many metres, results get noticeably less accurate. */
    const val FAR_WARNING_M = 5.0

    private const val EPSILON = 1e-6f

    /** Returns a * b. */
    fun multiply(a: FloatArray, b: FloatArray): FloatArray {
        val out = FloatArray(16)
        for (col in 0 until 4) {
            for (row in 0 until 4) {
                var sum = 0f
                for (k in 0 until 4) sum += a[k * 4 + row] * b[col * 4 + k]
                out[col * 4 + row] = sum
            }
        }
        return out
    }

    /** Returns m * (x, y, z, w) as a 4-component vector. */
    fun transform(m: FloatArray, x: Float, y: Float, z: Float, w: Float): FloatArray =
        floatArrayOf(
            m[0] * x + m[4] * y + m[8] * z + m[12] * w,
            m[1] * x + m[5] * y + m[9] * z + m[13] * w,
            m[2] * x + m[6] * y + m[10] * z + m[14] * w,
            m[3] * x + m[7] * y + m[11] * z + m[15] * w,
        )

    /** Returns the inverse of [m], or null if it can't be inverted. */
    fun invert(m: FloatArray): FloatArray? {
        // Cofactor expansion using 2x2 sub-determinants of the top and bottom row pairs.
        val a00 = m[0]; val a01 = m[4]; val a02 = m[8]; val a03 = m[12]
        val a10 = m[1]; val a11 = m[5]; val a12 = m[9]; val a13 = m[13]
        val a20 = m[2]; val a21 = m[6]; val a22 = m[10]; val a23 = m[14]
        val a30 = m[3]; val a31 = m[7]; val a32 = m[11]; val a33 = m[15]

        val s0 = a00 * a11 - a10 * a01
        val s1 = a00 * a12 - a10 * a02
        val s2 = a00 * a13 - a10 * a03
        val s3 = a01 * a12 - a11 * a02
        val s4 = a01 * a13 - a11 * a03
        val s5 = a02 * a13 - a12 * a03

        val c5 = a22 * a33 - a32 * a23
        val c4 = a21 * a33 - a31 * a23
        val c3 = a21 * a32 - a31 * a22
        val c2 = a20 * a33 - a30 * a23
        val c1 = a20 * a32 - a30 * a22
        val c0 = a20 * a31 - a30 * a21

        val det = s0 * c5 - s1 * c4 + s2 * c3 + s3 * c2 - s4 * c1 + s5 * c0
        if (abs(det) < 1e-12f || det.isNaN()) return null
        val inv = 1f / det

        // r[row][col] of the inverse, stored column-major.
        val out = FloatArray(16)
        out[0] = (a11 * c5 - a12 * c4 + a13 * c3) * inv
        out[4] = (-a01 * c5 + a02 * c4 - a03 * c3) * inv
        out[8] = (a31 * s5 - a32 * s4 + a33 * s3) * inv
        out[12] = (-a21 * s5 + a22 * s4 - a23 * s3) * inv

        out[1] = (-a10 * c5 + a12 * c2 - a13 * c1) * inv
        out[5] = (a00 * c5 - a02 * c2 + a03 * c1) * inv
        out[9] = (-a30 * s5 + a32 * s2 - a33 * s1) * inv
        out[13] = (a20 * s5 - a22 * s2 + a23 * s1) * inv

        out[2] = (a10 * c4 - a11 * c2 + a13 * c0) * inv
        out[6] = (-a00 * c4 + a01 * c2 - a03 * c0) * inv
        out[10] = (a30 * s4 - a31 * s2 + a33 * s0) * inv
        out[14] = (-a20 * s4 + a21 * s2 - a23 * s0) * inv

        out[3] = (-a10 * c3 + a11 * c1 - a12 * c0) * inv
        out[7] = (a00 * c3 - a01 * c1 + a02 * c0) * inv
        out[11] = (-a30 * s3 + a31 * s1 - a32 * s0) * inv
        out[15] = (a20 * s3 - a21 * s1 + a22 * s0) * inv
        return out
    }

    /**
     * Projects a world point to view pixels with a view-projection matrix.
     * Returns null for points behind the camera (w <= 0).
     */
    fun projectToScreen(viewProj: FloatArray, p: Vec3, width: Int, height: Int): ScreenPoint? {
        val c = transform(viewProj, p.x, p.y, p.z, 1f)
        return clipToScreen(c, width, height)
    }

    /**
     * Projects the segment a-b to the screen, clipped to the near plane, so a line with one end
     * behind the camera is still drawn up to the edge of view. Returns null if both ends are behind.
     */
    fun projectSegment(viewProj: FloatArray, a: Vec3, b: Vec3, width: Int, height: Int): ScreenSegment? {
        var ca = transform(viewProj, a.x, a.y, a.z, 1f)
        var cb = transform(viewProj, b.x, b.y, b.z, 1f)
        // In clip space a point is in front of the near plane when z + w >= 0.
        val da = ca[2] + ca[3]
        val db = cb[2] + cb[3]
        if (da < 0f && db < 0f) return null
        if (da < 0f) {
            ca = lerp4(ca, cb, da / (da - db))
        } else if (db < 0f) {
            cb = lerp4(cb, ca, db / (db - da))
        }
        val sa = clipToScreen(ca, width, height) ?: return null
        val sb = clipToScreen(cb, width, height) ?: return null
        return ScreenSegment(sa, sb)
    }

    /** Converts view pixels to normalised device coordinates (-1..1, y up). */
    fun screenToNdc(x: Float, y: Float, width: Int, height: Int): Pair<Float, Float> =
        Pair(2f * x / width - 1f, 1f - 2f * y / height)

    /**
     * Builds the world-space ray through a screen position given in normalised device
     * coordinates, using the inverse of (projection * view). Returns null if degenerate.
     */
    fun screenRay(invViewProj: FloatArray, ndcX: Float, ndcY: Float): Ray? {
        val near = transform(invViewProj, ndcX, ndcY, -1f, 1f)
        val far = transform(invViewProj, ndcX, ndcY, 1f, 1f)
        if (abs(near[3]) < EPSILON || abs(far[3]) < EPSILON) return null
        val origin = Vec3(near[0] / near[3], near[1] / near[3], near[2] / near[3])
        val end = Vec3(far[0] / far[3], far[1] / far[3], far[2] / far[3])
        val dir = end - origin
        if (dir.length() < EPSILON) return null
        return Ray(origin, dir.normalized())
    }

    /**
     * Intersects a ray with the infinite plane through [planePoint] with normal [planeNormal].
     * Returns null if the ray is parallel to the plane, the plane is behind the ray, or the hit is
     * further than [maxDistance].
     */
    fun intersectRayPlane(
        ray: Ray,
        planePoint: Vec3,
        planeNormal: Vec3,
        maxDistance: Float = FAR,
    ): Vec3? {
        val denom = planeNormal.dot(ray.direction)
        if (abs(denom) < EPSILON) return null
        val t = planeNormal.dot(planePoint - ray.origin) / denom
        if (t < 0f || t > maxDistance) return null
        return ray.origin + ray.direction * t
    }

    /** Signed distance from [point] to a plane; positive on the side the normal points to. */
    fun signedDistanceToPlane(point: Vec3, planePoint: Vec3, planeNormal: Vec3): Float =
        planeNormal.normalized().dot(point - planePoint)

    /** Straight-line distance between two points, in metres. */
    fun distance(a: Vec3, b: Vec3): Double {
        val dx = (b.x - a.x).toDouble()
        val dy = (b.y - a.y).toDouble()
        val dz = (b.z - a.z).toDouble()
        return sqrt(dx * dx + dy * dy + dz * dz)
    }

    /** Moves [previous] towards [target] by [factor]; with no previous value, jumps to the target. */
    fun lowPass(previous: Vec3?, target: Vec3, factor: Float = SMOOTHING): Vec3 {
        if (previous == null) return target
        return previous + (target - previous) * factor
    }

    private fun lerp4(from: FloatArray, to: FloatArray, t: Float): FloatArray =
        FloatArray(4) { i -> from[i] + (to[i] - from[i]) * t }

    private fun clipToScreen(c: FloatArray, width: Int, height: Int): ScreenPoint? {
        val w = c[3]
        if (w <= 0f) return null
        val ndcX = c[0] / w
        val ndcY = c[1] / w
        return ScreenPoint((ndcX + 1f) * 0.5f * width, (1f - ndcY) * 0.5f * height)
    }
}
