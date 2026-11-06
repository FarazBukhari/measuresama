package com.foxysama.measuresama.ar

import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.sqrt

/** A point or direction in AR world space, in metres. */
data class Vec3(val x: Float, val y: Float, val z: Float) {
    operator fun plus(o: Vec3) = Vec3(x + o.x, y + o.y, z + o.z)

    operator fun minus(o: Vec3) = Vec3(x - o.x, y - o.y, z - o.z)

    operator fun times(s: Float) = Vec3(x * s, y * s, z * s)

    fun dot(o: Vec3): Float = x * o.x + y * o.y + z * o.z

    /** Cross product this x o (right-handed). */
    fun cross(o: Vec3) = Vec3(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x)

    fun length(): Float = sqrt(dot(this))

    fun normalized(): Vec3 {
        val len = length()
        return if (len > 0f) this * (1f / len) else this
    }

    companion object {
        fun of(values: FloatArray) = Vec3(values[0], values[1], values[2])
    }
}

/** A box: length, width and height in metres, floor area in m², volume in m³. */
data class BoxResult(
    val lengthM: Double,
    val widthM: Double,
    val heightM: Double,
    val areaM2: Double,
    val volumeM3: Double,
)

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

    /** World up (ARCore's gravity-aligned y axis). */
    val UP = Vec3(0f, 1f, 0f)

    /** Highest a vertical aim (height, box top, wall height) may go, in metres. */
    const val MAX_VERTICAL_M = 10f

    /** Low-pass factor for the aimed point: how far it moves towards the new value each frame. */
    const val SMOOTHING = 0.35f

    /** Beyond this many metres, results get noticeably less accurate. */
    const val FAR_WARNING_M = 5.0

    private const val EPSILON = 1e-6f

    /** 1 - cos² of the smallest usable angle between a ray and the vertical (about 1.8 degrees). */
    private const val VERTICAL_PARALLEL_LIMIT = 1e-3

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

    /**
     * Lengths between consecutive points, in metres. With [closed] and 3+ points, the side from the
     * last point back to the first is added at the end (same as the web's segmentLengths).
     */
    fun segmentLengths(points: List<Vec3>, closed: Boolean): List<Double> {
        val out = ArrayList<Double>(points.size)
        for (i in 1 until points.size) out.add(distance(points[i - 1], points[i]))
        if (closed && points.size > 2) out.add(distance(points.last(), points.first()))
        return out
    }

    /** Length of the open line through [points], in metres (0 for fewer than 2 points). */
    fun polylineLength(points: List<Vec3>): Double = segmentLengths(points, closed = false).sum()

    /** Perimeter of the closed shape through [points], in metres (needs 3+ points to close). */
    fun polygonPerimeter(points: List<Vec3>): Double = segmentLengths(points, closed = true).sum()

    /**
     * Two unit vectors u, v that span the plane with [normal] (u, v and the normal are
     * perpendicular to each other; v = normal x u). A zero normal is treated as [UP].
     */
    fun planeBasis(normal: Vec3): Pair<Vec3, Vec3> {
        val n = if (normal.length() > EPSILON) normal.normalized() else UP
        // Any axis that is not almost parallel to the normal works as a seed.
        val seed = if (abs(n.x) < 0.9f) Vec3(1f, 0f, 0f) else Vec3(0f, 1f, 0f)
        val u = (seed - n * seed.dot(n)).normalized()
        val v = n.cross(u).normalized()
        return Pair(u, v)
    }

    /**
     * Normal of the best-fit plane through a polygon (Newell's method), or null if the points
     * are fewer than 3 or all on one line.
     */
    fun newellNormal(points: List<Vec3>): Vec3? {
        if (points.size < 3) return null
        var nx = 0.0
        var ny = 0.0
        var nz = 0.0
        for (i in points.indices) {
            val a = points[i]
            val b = points[(i + 1) % points.size]
            nx += (a.y - b.y).toDouble() * (a.z + b.z)
            ny += (a.z - b.z).toDouble() * (a.x + b.x)
            nz += (a.x - b.x).toDouble() * (a.y + b.y)
        }
        val len = sqrt(nx * nx + ny * ny + nz * nz)
        if (!(len > 1e-12)) return null
        return Vec3((nx / len).toFloat(), (ny / len).toFloat(), (nz / len).toFloat())
    }

    /**
     * Area of the polygon through [points] in square metres: the points are projected onto the
     * plane with [normal] (see [planeBasis]) and measured with the shoelace formula. Works for
     * either winding order; 0 for fewer than 3 points.
     */
    fun polygonArea(points: List<Vec3>, normal: Vec3): Double {
        if (points.size < 3) return 0.0
        val (u, v) = planeBasis(normal)
        // Measure from the first point so large world coordinates don't lose float precision.
        val origin = points[0]
        val xs = DoubleArray(points.size)
        val ys = DoubleArray(points.size)
        for (i in points.indices) {
            val d = points[i] - origin
            xs[i] = d.x.toDouble() * u.x + d.y.toDouble() * u.y + d.z.toDouble() * u.z
            ys[i] = d.x.toDouble() * v.x + d.y.toDouble() * v.y + d.z.toDouble() * v.z
        }
        var twice = 0.0
        for (i in points.indices) {
            val j = (i + 1) % points.size
            twice += xs[i] * ys[j] - xs[j] * ys[i]
        }
        return abs(twice) / 2.0
    }

    /**
     * Angle at [vertex] between the arms to [a] and [b], in degrees (0..180).
     * 0 if either arm has no length.
     */
    fun angleDeg(a: Vec3, vertex: Vec3, b: Vec3): Double {
        val ax = (a.x - vertex.x).toDouble(); val ay = (a.y - vertex.y).toDouble(); val az = (a.z - vertex.z).toDouble()
        val bx = (b.x - vertex.x).toDouble(); val by = (b.y - vertex.y).toDouble(); val bz = (b.z - vertex.z).toDouble()
        val la = sqrt(ax * ax + ay * ay + az * az)
        val lb = sqrt(bx * bx + by * by + bz * bz)
        if (la < 1e-9 || lb < 1e-9) return 0.0
        val cos = ((ax * bx + ay * by + az * bz) / (la * lb)).coerceIn(-1.0, 1.0)
        return Math.toDegrees(acos(cos))
    }

    /**
     * Aiming at something straight above [base] (a pole, a box top, a wall's top edge): the point on
     * the vertical line base + t * [up] that comes closest to the camera [ray] (closest points of two
     * lines), with t kept within 0..[maxHeight]. Null when the ray is (nearly) parallel to the
     * vertical line, or when the closest point would be behind the camera.
     */
    fun verticalAim(base: Vec3, ray: Ray, up: Vec3 = UP, maxHeight: Float = MAX_VERTICAL_M): Vec3? {
        val u = up.normalized()
        val d = ray.direction.normalized()
        val w0 = base - ray.origin
        val b = u.dot(d).toDouble()
        val denom = 1.0 - b * b // |u| = |d| = 1
        if (denom < VERTICAL_PARALLEL_LIMIT) return null
        val dw = u.dot(w0).toDouble()
        val ew = d.dot(w0).toDouble()
        val t = (b * ew - dw) / denom
        val s = (ew - b * dw) / denom
        if (s < 0.0) return null
        val clamped = t.coerceIn(0.0, maxHeight.toDouble()).toFloat()
        return base + u * clamped
    }

    /**
     * Moves [c] so that b -> c' is level (in the horizontal plane through [b]) and perpendicular to
     * a -> b: drops the vertical part of b -> c and the part along a -> b. Used for a box's width.
     */
    fun snapPerpendicular(a: Vec3, b: Vec3, c: Vec3, up: Vec3 = UP): Vec3 {
        val u = up.normalized()
        var bc = c - b
        bc -= u * bc.dot(u)
        var ab = b - a
        ab -= u * ab.dot(u)
        if (ab.length() > EPSILON) {
            val along = ab.normalized()
            bc -= along * bc.dot(along)
        }
        return b + bc
    }

    /**
     * Box from floor corners [a], [b], [c] and [top] above c: c is snapped with
     * [snapPerpendicular] first, so length = |ab|, width = |bc'|, height = |top - c'|.
     */
    fun boxResult(a: Vec3, b: Vec3, c: Vec3, top: Vec3, up: Vec3 = UP): BoxResult {
        val snapped = snapPerpendicular(a, b, c, up)
        val length = distance(a, b)
        val width = distance(b, snapped)
        val height = distance(snapped, top)
        return BoxResult(length, width, height, length * width, length * width * height)
    }

    /** Distance between two screen positions, in view pixels. */
    fun screenDistance(p: ScreenPoint, q: ScreenPoint): Float {
        val dx = q.x - p.x
        val dy = q.y - p.y
        return sqrt(dx * dx + dy * dy)
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
