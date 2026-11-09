package com.foxysama.measuresama.ar

/** The AR modes, with the ids used over the plugin bridge (definitions.ts ArMode). */
enum class MeasureMode(val id: String) {
    DISTANCE("distance"),
    PATH("path"),
    AREA("area"),
    ANGLE("angle"),
    HEIGHT("height"),
    VOLUME("volume"),
    ROOM_PLAN("room-plan"),
    ;

    companion object {
        /** The mode for a bridge id, or null if unknown (e.g. "photo", which is web-only). */
        fun fromId(id: String?): MeasureMode? = entries.firstOrNull { it.id == id }
    }
}

/** What the next point needs from the aim. */
enum class AimKind {
    /** A hit on any tracked plane. */
    SURFACE,

    /** A hit on a horizontal, upward-facing plane (the floor or a table). */
    FLOOR,

    /** A point straight above [MeasureFlow.verticalBase], from [MeasureMath.verticalAim]. */
    VERTICAL,
}

/** What [MeasureFlow.add] did with a point. */
enum class AddOutcome { ADDED, REPLACED_LAST, CLOSED, IGNORED }

/** Which hint to show next. The activity maps each key to a short string. */
enum class ProgressKey {
    /** Place the first point (distance, path, angle). */
    START,

    /** Place the end point (distance). */
    END,

    /** Place the next point (path). */
    NEXT,

    /** Add more points or save (path, area). */
    ADD_OR_SAVE,

    /** Place the first corner (area, volume, room plan). */
    CORNER,

    /** Place the next corner (area, volume, room plan). */
    NEXT_CORNER,

    /** Place the corner point of an angle. */
    VERTEX,

    /** Place the end of the angle's second arm. */
    OTHER_END,

    /** Place the bottom point on the floor (height). */
    BASE,

    /** Aim up to the top (height, volume). */
    RAISE_TOP,

    /** Close the room on the first corner, or save (room plan). */
    CLOSE_OR_SAVE,

    /** Aim at the top of the wall above the first corner, or save (room plan). */
    WALL_HEIGHT,

    /** Complete: save, or tap again to move the last point. */
    DONE,
}

/** What [LiveGeometry.value] measures. */
enum class ValueKind { LENGTH, AREA, VOLUME, ANGLE }

/** How a live segment is drawn. */
enum class SegmentKind {
    /** A side between two consecutive points. */
    EDGE,

    /** The side that closes a shape, from the last point back to the first. */
    CLOSING,

    /** A vertical line from a base point up to a top (height, box, wall height). */
    VERTICAL,
}

/** A line for the overlay; [preview] is true when one end is the aim, not a placed point. */
data class LiveSegment(
    val a: Vec3,
    val b: Vec3,
    val lengthM: Double,
    val kind: SegmentKind,
    val preview: Boolean,
)

/**
 * Everything the overlay draws for one frame.
 * - [points]: placed points (room plan: corners only; the wall top is [wallTop]).
 * - [preview]: where the next point would go (already snapped or made vertical), or null.
 * - [replacesLast]: the preview would move the last placed point instead of adding one.
 * - [value] / [valueKind]: the main number (metres, m², m³ or degrees), or null if not enough points.
 */
data class LiveGeometry(
    val points: List<Vec3>,
    val wallTop: Vec3?,
    val preview: Vec3?,
    val replacesLast: Boolean,
    val segments: List<LiveSegment>,
    val value: Double?,
    val valueKind: ValueKind,
)

/**
 * A finished measurement, with the fields of the plugin contract's ArMeasurement for [mode]
 * (unrounded; the plugin rounds to 5 decimals, angles to 3). Fields a mode doesn't use are null.
 */
data class ModeResult(
    val mode: MeasureMode,
    val points: List<Vec3>,
    val distanceM: Double? = null,
    val segmentsM: List<Double>? = null,
    val perimeterM: Double? = null,
    val areaM2: Double? = null,
    val angleDeg: Double? = null,
    val heightM: Double? = null,
    val lengthM: Double? = null,
    val widthM: Double? = null,
    val volumeM3: Double? = null,
    val wallHeightM: Double? = null,
)

/**
 * The step-by-step state of one AR measurement, per mode. Pure Kotlin (no ARCore), so it runs in
 * JUnit. The engine finds the aim (a plane hit, or [MeasureMath.verticalAim] for [AimKind.VERTICAL])
 * and feeds it here; this class decides what a tap does and what the result is.
 *
 * Not thread-safe: use it from one thread (the GL thread).
 */
class MeasureFlow(val mode: MeasureMode) {
    private val placed = ArrayList<Vec3>()

    /** Room plan: the shape was closed and the optional wall height phase is on. */
    var closed: Boolean = false
        private set

    /** Room plan: the point above corner 1 marking the wall's top, once placed. */
    var wallTop: Vec3? = null
        private set

    /** Placed points (room plan: corners). Volume's 3rd point is stored snapped. */
    val points: List<Vec3> get() = placed.toList()

    val pointCount: Int get() = placed.size

    /** What the next tap needs. */
    fun aimKind(): AimKind = when (mode) {
        MeasureMode.DISTANCE, MeasureMode.PATH, MeasureMode.AREA, MeasureMode.ANGLE -> AimKind.SURFACE
        MeasureMode.HEIGHT -> if (placed.isEmpty()) AimKind.FLOOR else AimKind.VERTICAL
        MeasureMode.VOLUME -> if (placed.size < 3) AimKind.FLOOR else AimKind.VERTICAL
        MeasureMode.ROOM_PLAN -> if (closed) AimKind.VERTICAL else AimKind.FLOOR
    }

    /** The point a vertical aim rises from, or null while the aim is not vertical. */
    fun verticalBase(): Vec3? = when (mode) {
        MeasureMode.HEIGHT -> placed.getOrNull(0)
        MeasureMode.VOLUME -> if (placed.size >= 3) placed[2] else null
        MeasureMode.ROOM_PLAN -> if (closed) placed.getOrNull(0) else null
        else -> null
    }

    /**
     * Places a point. Once a fixed-size mode is full, a tap moves its last point (distance: B,
     * angle: the 3rd point, height and volume: the top). Path, area and room plan stop at
     * [MAX_POINTS]. Room plan: with [nearFirst] (see [canClose]) and 3+ corners, the tap closes the
     * room; after closing, taps set the wall height. Non-finite points are ignored.
     */
    fun add(p: Vec3, nearFirst: Boolean = false): AddOutcome {
        if (!p.isFinite()) return AddOutcome.IGNORED
        return when (mode) {
            MeasureMode.DISTANCE -> addOrReplace(p, 2)
            MeasureMode.ANGLE -> addOrReplace(p, 3)
            MeasureMode.HEIGHT -> addOrReplace(resolve(p), 2)
            MeasureMode.VOLUME -> addOrReplace(resolve(p), 4)
            MeasureMode.PATH, MeasureMode.AREA -> addCapped(p)
            MeasureMode.ROOM_PLAN -> when {
                closed -> {
                    val had = wallTop != null
                    wallTop = resolve(p)
                    if (had) AddOutcome.REPLACED_LAST else AddOutcome.ADDED
                }
                nearFirst && close() -> AddOutcome.CLOSED
                else -> addCapped(p)
            }
        }
    }

    /**
     * Room plan: true when the aim is within [thresholdPx] of the first corner on screen and the
     * room can be closed (3+ corners, not closed yet).
     */
    fun canClose(aimScreen: ScreenPoint?, firstScreen: ScreenPoint?, thresholdPx: Float): Boolean {
        if (mode != MeasureMode.ROOM_PLAN || closed || placed.size < 3) return false
        if (aimScreen == null || firstScreen == null) return false
        return MeasureMath.screenDistance(aimScreen, firstScreen) <= thresholdPx
    }

    /** Room plan: closes the room (3+ corners) and starts the optional wall height. False if it can't. */
    fun close(): Boolean {
        if (mode != MeasureMode.ROOM_PLAN || closed || placed.size < 3) return false
        closed = true
        return true
    }

    /** Steps back once: the wall height, then the closing, then the last point. False if empty. */
    fun undo(): Boolean {
        if (wallTop != null) {
            wallTop = null
            return true
        }
        if (closed) {
            closed = false
            return true
        }
        if (placed.isEmpty()) return false
        placed.removeAt(placed.lastIndex)
        return true
    }

    fun clear() {
        placed.clear()
        closed = false
        wallTop = null
    }

    /** Enough points to save a result. */
    fun canSave(): Boolean = when (mode) {
        MeasureMode.DISTANCE -> placed.size == 2
        MeasureMode.PATH -> placed.size >= 2
        MeasureMode.AREA -> placed.size >= 3
        MeasureMode.ANGLE -> placed.size == 3
        MeasureMode.HEIGHT -> placed.size == 2
        MeasureMode.VOLUME -> placed.size == 4
        MeasureMode.ROOM_PLAN -> placed.size >= 3
    }

    /** The hint for the current step. */
    fun progressKey(): ProgressKey {
        val n = placed.size
        return when (mode) {
            MeasureMode.DISTANCE -> when (n) {
                0 -> ProgressKey.START
                1 -> ProgressKey.END
                else -> ProgressKey.DONE
            }
            MeasureMode.PATH -> when {
                n == 0 -> ProgressKey.START
                n == 1 -> ProgressKey.NEXT
                n >= MAX_POINTS -> ProgressKey.DONE
                else -> ProgressKey.ADD_OR_SAVE
            }
            MeasureMode.AREA -> when {
                n == 0 -> ProgressKey.CORNER
                n < 3 -> ProgressKey.NEXT_CORNER
                n >= MAX_POINTS -> ProgressKey.DONE
                else -> ProgressKey.ADD_OR_SAVE
            }
            MeasureMode.ANGLE -> when (n) {
                0 -> ProgressKey.START
                1 -> ProgressKey.VERTEX
                2 -> ProgressKey.OTHER_END
                else -> ProgressKey.DONE
            }
            MeasureMode.HEIGHT -> when (n) {
                0 -> ProgressKey.BASE
                1 -> ProgressKey.RAISE_TOP
                else -> ProgressKey.DONE
            }
            MeasureMode.VOLUME -> when (n) {
                0 -> ProgressKey.CORNER
                1, 2 -> ProgressKey.NEXT_CORNER
                3 -> ProgressKey.RAISE_TOP
                else -> ProgressKey.DONE
            }
            MeasureMode.ROOM_PLAN -> when {
                closed -> if (wallTop == null) ProgressKey.WALL_HEIGHT else ProgressKey.DONE
                n == 0 -> ProgressKey.CORNER
                n < 3 -> ProgressKey.NEXT_CORNER
                else -> ProgressKey.CLOSE_OR_SAVE
            }
        }
    }

    /**
     * The shape to draw with [aim] as a preview of the next tap (snapped or made vertical as the tap
     * would be). [planeNormal] is the area mode's plane; without it the polygon's own plane is used.
     */
    fun live(aim: Vec3?, planeNormal: Vec3? = null): LiveGeometry {
        val target = aim?.takeIf { it.isFinite() }?.let { previewFor(it) }
        val replacesLast = target != null && previewReplacesLast()

        // Room plan after closing: the corners are fixed; the preview is the wall top.
        if (mode == MeasureMode.ROOM_PLAN && closed) {
            val top = target ?: wallTop
            val segments = edges(placed, closeShape = true, previewIndex = -1).toMutableList()
            if (top != null) {
                segments.add(segment(placed[0], top, SegmentKind.VERTICAL, preview = target != null))
            }
            return LiveGeometry(
                points = placed.toList(),
                wallTop = wallTop,
                preview = target,
                replacesLast = target != null && wallTop != null,
                segments = segments,
                value = MeasureMath.polygonArea(placed, MeasureMath.UP),
                valueKind = ValueKind.AREA,
            )
        }

        // The shape as it would be after the tap.
        val shape = ArrayList(placed)
        var previewIndex = -1
        if (target != null) {
            if (replacesLast) shape[shape.lastIndex] = target else shape.add(target)
            previewIndex = shape.lastIndex
        }

        val segments: List<LiveSegment>
        val value: Double?
        val kind: ValueKind
        when (mode) {
            MeasureMode.DISTANCE, MeasureMode.PATH -> {
                segments = edges(shape, closeShape = false, previewIndex = previewIndex)
                value = if (shape.size >= 2) MeasureMath.polylineLength(shape) else null
                kind = ValueKind.LENGTH
            }
            MeasureMode.AREA, MeasureMode.ROOM_PLAN -> {
                segments = edges(shape, closeShape = true, previewIndex = previewIndex)
                val normal = if (mode == MeasureMode.ROOM_PLAN) {
                    MeasureMath.UP
                } else {
                    planeNormal ?: MeasureMath.newellNormal(shape) ?: MeasureMath.UP
                }
                if (shape.size >= 3) {
                    value = MeasureMath.polygonArea(shape, normal)
                    kind = ValueKind.AREA
                } else {
                    value = if (shape.size == 2) MeasureMath.polylineLength(shape) else null
                    kind = ValueKind.LENGTH
                }
            }
            MeasureMode.ANGLE -> {
                segments = edges(shape, closeShape = false, previewIndex = previewIndex)
                value = if (shape.size == 3) MeasureMath.angleDeg(shape[0], shape[1], shape[2]) else null
                kind = ValueKind.ANGLE
            }
            MeasureMode.HEIGHT -> {
                segments = if (shape.size == 2) {
                    listOf(segment(shape[0], shape[1], SegmentKind.VERTICAL, previewIndex == 1))
                } else {
                    emptyList()
                }
                value = if (shape.size == 2) MeasureMath.distance(shape[0], shape[1]) else null
                kind = ValueKind.LENGTH
            }
            MeasureMode.VOLUME -> {
                val list = edges(shape.take(3), closeShape = false, previewIndex = previewIndex).toMutableList()
                if (shape.size == 4) list.add(segment(shape[2], shape[3], SegmentKind.VERTICAL, previewIndex == 3))
                segments = list
                when (shape.size) {
                    2 -> {
                        value = MeasureMath.distance(shape[0], shape[1])
                        kind = ValueKind.LENGTH
                    }
                    3 -> {
                        value = MeasureMath.distance(shape[0], shape[1]) * MeasureMath.distance(shape[1], shape[2])
                        kind = ValueKind.AREA
                    }
                    4 -> {
                        value = MeasureMath.boxResult(shape[0], shape[1], shape[2], shape[3]).volumeM3
                        kind = ValueKind.VOLUME
                    }
                    else -> {
                        value = null
                        kind = ValueKind.VOLUME
                    }
                }
            }
        }
        return LiveGeometry(placed.toList(), wallTop, target, replacesLast, segments, value, kind)
    }

    /**
     * The result to save, or null unless [canSave]. [planeNormal] is the area mode's plane
     * (without it the polygon's own plane is used); volume and room plan always use the floor (up).
     */
    fun result(planeNormal: Vec3? = null): ModeResult? {
        if (!canSave()) return null
        val pts = placed.toList()
        return when (mode) {
            MeasureMode.DISTANCE -> ModeResult(mode, pts, distanceM = MeasureMath.distance(pts[0], pts[1]))
            MeasureMode.PATH -> {
                val segments = MeasureMath.segmentLengths(pts, closed = false)
                ModeResult(mode, pts, distanceM = segments.sum(), segmentsM = segments)
            }
            MeasureMode.AREA -> {
                val segments = MeasureMath.segmentLengths(pts, closed = true)
                val perimeter = segments.sum()
                val normal = planeNormal ?: MeasureMath.newellNormal(pts) ?: MeasureMath.UP
                ModeResult(
                    mode, pts,
                    distanceM = perimeter,
                    segmentsM = segments,
                    perimeterM = perimeter,
                    areaM2 = MeasureMath.polygonArea(pts, normal),
                )
            }
            MeasureMode.ANGLE -> ModeResult(
                mode, pts,
                angleDeg = MeasureMath.angleDeg(pts[0], pts[1], pts[2]),
                segmentsM = listOf(MeasureMath.distance(pts[0], pts[1]), MeasureMath.distance(pts[2], pts[1])),
            )
            MeasureMode.HEIGHT -> {
                val height = MeasureMath.distance(pts[0], pts[1])
                ModeResult(mode, pts, distanceM = height, heightM = height)
            }
            MeasureMode.VOLUME -> {
                val box = MeasureMath.boxResult(pts[0], pts[1], pts[2], pts[3])
                ModeResult(
                    mode, pts,
                    lengthM = box.lengthM,
                    widthM = box.widthM,
                    heightM = box.heightM,
                    areaM2 = box.areaM2,
                    volumeM3 = box.volumeM3,
                )
            }
            MeasureMode.ROOM_PLAN -> {
                val segments = MeasureMath.segmentLengths(pts, closed = true)
                val perimeter = segments.sum()
                ModeResult(
                    mode, pts,
                    distanceM = perimeter,
                    segmentsM = segments,
                    perimeterM = perimeter,
                    areaM2 = MeasureMath.polygonArea(pts, MeasureMath.UP),
                    wallHeightM = wallTop?.let { MeasureMath.distance(pts[0], it) },
                )
            }
        }
    }

    /** The aim turned into the point a tap would place now (snapped or vertical as needed). */
    private fun previewFor(aim: Vec3): Vec3? = when (mode) {
        MeasureMode.PATH, MeasureMode.AREA -> if (placed.size >= MAX_POINTS) null else aim
        MeasureMode.ROOM_PLAN -> if (!closed && placed.size >= MAX_POINTS) null else resolve(aim)
        else -> resolve(aim)
    }

    private fun previewReplacesLast(): Boolean = when (mode) {
        MeasureMode.DISTANCE -> placed.size >= 2
        MeasureMode.ANGLE -> placed.size >= 3
        MeasureMode.HEIGHT -> placed.size >= 2
        MeasureMode.VOLUME -> placed.size >= 4
        else -> false
    }

    /**
     * Applies the mode's constraint to a tapped point: volume's 3rd point is snapped square to the
     * first edge; tops (height, box, wall) are put exactly above their base, never below it.
     */
    private fun resolve(p: Vec3): Vec3 {
        if (mode == MeasureMode.VOLUME && placed.size == 2) {
            return MeasureMath.snapPerpendicular(placed[0], placed[1], p)
        }
        val base = verticalBase() ?: return p
        val rise = (p - base).dot(MeasureMath.UP).coerceIn(0f, MeasureMath.MAX_VERTICAL_M)
        return base + MeasureMath.UP * rise
    }

    private fun addOrReplace(p: Vec3, size: Int): AddOutcome {
        if (placed.size < size) {
            placed.add(p)
            return AddOutcome.ADDED
        }
        placed[placed.lastIndex] = p
        return AddOutcome.REPLACED_LAST
    }

    private fun addCapped(p: Vec3): AddOutcome {
        if (placed.size >= MAX_POINTS) return AddOutcome.IGNORED
        placed.add(p)
        return AddOutcome.ADDED
    }

    private fun edges(shape: List<Vec3>, closeShape: Boolean, previewIndex: Int): List<LiveSegment> {
        val out = ArrayList<LiveSegment>()
        for (i in 1 until shape.size) {
            val preview = i == previewIndex || i - 1 == previewIndex
            out.add(segment(shape[i - 1], shape[i], SegmentKind.EDGE, preview))
        }
        if (closeShape && shape.size >= 3) {
            val preview = previewIndex == shape.lastIndex
            out.add(segment(shape.last(), shape.first(), SegmentKind.CLOSING, preview))
        }
        return out
    }

    private fun segment(a: Vec3, b: Vec3, kind: SegmentKind, preview: Boolean) =
        LiveSegment(a, b, MeasureMath.distance(a, b), kind, preview)

    private fun Vec3.isFinite() = x.isFinite() && y.isFinite() && z.isFinite()

    companion object {
        /** Most points a path, area or room plan can have. */
        const val MAX_POINTS = 50
    }
}
