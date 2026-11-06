package com.foxysama.measuresama.ar

import android.util.Log
import com.google.ar.core.Anchor
import com.google.ar.core.Frame
import com.google.ar.core.Plane
import com.google.ar.core.Pose
import com.google.ar.core.Session
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState
import java.util.Queue
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin

/** UI actions, queued on the main thread and run on the GL thread at the start of the next frame. */
enum class Command { ADD_POINT, UNDO, CLEAR, SAVE }

/** Plain-language texts for the hint line, resolved from strings.xml on the main thread. */
data class HintTexts(
    val coaching: String,
    val aimFloor: String,
    val closeRoom: String,
    /** One short hint per step of the measurement. */
    val progress: Map<ProgressKey, String>,
    val tooDark: String,
    val tooFast: String,
    val lowTexture: String,
    val cameraBusy: String,
    val gettingReady: String,
    val farWarning: String,
)

/**
 * The AR measuring engine for every AR mode. GL THREAD ONLY: every method here touches ARCore
 * objects (frame, planes, anchors), so it must run inside onDrawFrame, apart from [detachAll], which
 * the activity calls in onDestroy after the GL thread has been paused.
 *
 * The steps of a measurement (what a tap does, what the result is) live in the pure [MeasureFlow];
 * this class finds the aim, keeps one ARCore anchor per placed point, and turns the flow's live
 * geometry into an [OverlayState].
 *
 * Aiming ([MeasureFlow.aimKind]): the reticle sits at the screen centre.
 * - SURFACE: until a surface is locked, ARCore hit tests are used, accepting only tracked,
 *   non-subsumed planes where the hit lies inside the plane polygon. The first such hit locks that
 *   plane. After that, the centre ray is intersected with the locked plane extended to infinity, so
 *   a line can run past the area ARCore has detected.
 * - FLOOR: the same, but only horizontal upward-facing planes are hit or locked.
 * - VERTICAL: no plane is needed; the aim is the point straight above the flow's base that is
 *   closest to the centre ray ([MeasureMath.verticalAim]).
 *
 * Anchors: one per placed point (vertical tops and the snapped box corner are anchored at their
 * computed positions), plus one for the room's wall top. Each frame the flow is rebuilt from the
 * anchor poses, so points follow ARCore's corrections.
 */
class MeasureSession(
    private val mode: MeasureMode,
    private val unit: String,
    private val texts: HintTexts,
    private val listener: Listener,
    /** Display density (px per dp), for the room-close snap distance and label spacing. */
    private val density: Float,
) {
    /** Events for the activity. Called on the GL thread; implementations post to the main thread. */
    interface Listener {
        fun onPlaneLocked()

        /** A point was placed or moved, or the room was closed. */
        fun onPointAdded()

        /** An add-point tap arrived with nothing usable under the aim circle. */
        fun onAddRejected()

        /** Save: the result, and the overlay to draw on the screenshot (no reticle or preview). */
        fun onSaveReady(result: ModeResult, capture: OverlayState)

        fun onSaveUnavailable()
    }

    private val flow = MeasureFlow(mode)
    private var lockedPlane: Plane? = null

    /** One per flow point, in the same order. */
    private val anchors = ArrayList<Anchor>()

    /** Room plan: the anchor of [MeasureFlow.wallTop]. */
    private var wallTopAnchor: Anchor? = null
    private var smoothedAim: Vec3? = null

    /** The aim kind [smoothedAim] was found for. A tap only uses an aim of the current kind. */
    private var smoothedKind: AimKind? = null

    /** Room plan: the aim is on the first corner (last frame), so the next tap closes the room. */
    private var closeSnap = false
    private var saveRequested = false
    private val viewMatrix = FloatArray(16)
    private val projectionMatrix = FloatArray(16)

    /** Runs one frame: applies queued commands, aims, and returns what the overlay should draw. */
    fun onFrame(
        session: Session,
        frame: Frame,
        width: Int,
        height: Int,
        commands: Queue<Command>,
    ): OverlayState {
        val camera = frame.camera
        val tracking = camera.trackingState == TrackingState.TRACKING
        drainCommands(session, commands, tracking)
        dropStoppedAnchors()
        syncFlowFromAnchors()

        if (!tracking || width <= 0 || height <= 0) {
            // Stop drawing points and lines until tracking is back; say why.
            smoothedAim = null
            closeSnap = false
            val state =
                OverlayState(
                    tracking = false,
                    hint = trackingHint(camera.trackingFailureReason),
                    pointCount = flow.pointCount,
                    planeLocked = lockedPlane != null,
                    onSurface = false,
                    scanning = lockedPlane == null && flow.aimKind() != AimKind.VERTICAL,
                    canSave = flow.canSave(),
                    canUndo = flow.pointCount > 0,
                    canClear = flow.pointCount > 0 || lockedPlane != null,
                    aimKind = flow.aimKind(),
                )
            if (saveRequested) finishSave(state)
            return state
        }

        camera.getProjectionMatrix(projectionMatrix, 0, MeasureMath.NEAR, MeasureMath.FAR)
        camera.getViewMatrix(viewMatrix, 0)
        val viewProj = MeasureMath.multiply(projectionMatrix, viewMatrix)
        val cameraPosition = toVec(camera.pose)

        val kind = flow.aimKind()
        if (kind != smoothedKind) {
            // A new kind of aim (e.g. from the floor to straight up): don't glide from the old one.
            smoothedAim = null
            smoothedKind = kind
        }
        val aim = findAim(frame, width, height, MeasureMath.invert(viewProj), cameraPosition, kind)
        smoothedAim = aim?.let { MeasureMath.lowPass(smoothedAim, it) }
        val currentAim = smoothedAim
        val normal = areaNormal()

        // Room plan: snap onto the first corner when the aim is close to it on screen.
        val centre = ScreenPoint(width / 2f, height / 2f)
        val firstScreen = flow.points.firstOrNull()?.let { MeasureMath.projectToScreen(viewProj, it, width, height) }
        val aimScreen = currentAim?.let { MeasureMath.projectToScreen(viewProj, it, width, height) } ?: centre
        closeSnap = currentAim != null && flow.canClose(aimScreen, firstScreen, CLOSE_SNAP_DP * density)

        // A full fixed-size shape stays put while aiming; a tap moves its last point.
        var live = flow.live(if (closeSnap) null else currentAim, normal)
        if (live.replacesLast) live = flow.live(null, normal)

        val aimIsFar =
            currentAim != null && MeasureMath.distance(cameraPosition, currentAim) > MeasureMath.FAR_WARNING_M
        val segmentIsFar = live.segments.any { it.lengthM > MeasureMath.FAR_WARNING_M }

        val drawn = draw(live, viewProj, width, height, currentAim, kind)
        val state =
            drawn.copy(
                tracking = true,
                reticle = if (closeSnap && firstScreen != null) firstScreen else centre,
                reticleState = if (currentAim != null) ReticleState.ON_SURFACE else ReticleState.SEARCHING,
                snapClose = closeSnap,
                hint = progressHint(kind),
                warning = if (aimIsFar || segmentIsFar) texts.farWarning else null,
                pointCount = flow.pointCount,
                planeLocked = lockedPlane != null,
                onSurface = currentAim != null,
                scanning = lockedPlane == null && kind != AimKind.VERTICAL,
                canSave = flow.canSave(),
                canUndo = flow.pointCount > 0,
                canClear = flow.pointCount > 0 || lockedPlane != null,
                aimKind = kind,
            )
        if (saveRequested) {
            val placed = draw(flow.live(null, normal), viewProj, width, height, null, kind)
            finishSave(placed.copy(tracking = true))
        }
        return state
    }

    /** Releases every anchor and the locked surface. Call only while the GL thread is paused or stopped. */
    fun detachAll() {
        anchors.forEach { it.detach() }
        anchors.clear()
        wallTopAnchor?.detach()
        wallTopAnchor = null
        flow.clear()
        lockedPlane = null
        smoothedAim = null
        closeSnap = false
    }

    private fun drainCommands(session: Session, commands: Queue<Command>, tracking: Boolean) {
        saveRequested = false
        // One change per frame: an add uses the aim found for the flow as it was last frame.
        var changed = false
        while (true) {
            when (commands.poll() ?: return) {
                Command.ADD_POINT ->
                    when {
                        !tracking -> listener.onAddRejected()
                        !changed -> changed = addPoint(session)
                    }
                Command.UNDO -> {
                    undo()
                    changed = true
                }
                Command.CLEAR -> {
                    // Also resets the surface, with or without points.
                    detachAll()
                    changed = true
                }
                Command.SAVE -> saveRequested = true
            }
        }
    }

    /** Places (or moves) a point at the aim, or closes the room. True if anything changed. */
    private fun addPoint(session: Session): Boolean {
        val aim = smoothedAim
        if (aim == null) {
            listener.onAddRejected()
            return false
        }
        if (closeSnap && flow.close()) {
            closeSnap = false
            listener.onPointAdded()
            return true
        }
        // The aim was found for another step of the flow: wait for a fresh one.
        if (smoothedKind != flow.aimKind()) return false
        // Where the tap puts the point (snapped or straight above its base); null when full.
        val target = flow.live(aim).preview ?: return false
        val anchor =
            try {
                session.createAnchor(Pose.makeTranslation(target.x, target.y, target.z))
            } catch (e: Exception) {
                // e.g. NotTrackingException if tracking dropped this instant: ignore the tap.
                Log.w(TAG, "Couldn't place a point", e)
                return false
            }
        val wallTop = flow.closed
        when (flow.add(target)) {
            AddOutcome.ADDED -> if (wallTop) wallTopAnchor = anchor else anchors.add(anchor)
            AddOutcome.REPLACED_LAST ->
                if (wallTop) {
                    wallTopAnchor?.detach()
                    wallTopAnchor = anchor
                } else if (anchors.isEmpty()) {
                    anchors.add(anchor)
                } else {
                    anchors[anchors.lastIndex].detach()
                    anchors[anchors.lastIndex] = anchor
                }
            AddOutcome.CLOSED, AddOutcome.IGNORED -> {
                anchor.detach()
                return false
            }
        }
        listener.onPointAdded()
        return true
    }

    private fun undo() {
        val hadTop = flow.wallTop != null
        if (!flow.undo()) return
        if (hadTop && flow.wallTop == null) {
            wallTopAnchor?.detach()
            wallTopAnchor = null
        }
        while (anchors.size > flow.pointCount) anchors.removeAt(anchors.lastIndex).detach()
    }

    /** A point whose anchor stopped is lost, and so is every point placed after it. */
    private fun dropStoppedAnchors() {
        val first = anchors.indexOfFirst { it.trackingState == TrackingState.STOPPED }
        if (first >= 0) {
            while (anchors.size > first) anchors.removeAt(anchors.lastIndex).detach()
        }
        val top = wallTopAnchor
        if (top != null && top.trackingState == TrackingState.STOPPED) {
            top.detach()
            wallTopAnchor = null
        }
    }

    /** Rebuilds the flow from the anchor poses; adding again re-applies each mode's constraints. */
    private fun syncFlowFromAnchors() {
        val wasClosed = flow.closed
        flow.clear()
        for (anchor in anchors) flow.add(toVec(anchor.pose))
        val closed = wasClosed && flow.close()
        val top = wallTopAnchor ?: return
        if (closed) {
            flow.add(toVec(top.pose))
        } else {
            top.detach()
            wallTopAnchor = null
        }
    }

    private fun finishSave(capture: OverlayState) {
        val result = flow.result(areaNormal())
        if (result == null) listener.onSaveUnavailable() else listener.onSaveReady(result, capture)
    }

    /** Area mode: the locked surface's normal, so the area is measured in that plane. */
    private fun areaNormal(): Vec3? =
        if (mode == MeasureMode.AREA) lockedPlane?.centerPose?.let { Vec3.of(it.yAxis) } else null

    /**
     * Projects the live geometry: points, lines, fill, arc, guide and labels. [aim] (null for the
     * screenshot) enables the preview dot and the vertical guide.
     */
    private fun draw(
        live: LiveGeometry,
        viewProj: FloatArray,
        width: Int,
        height: Int,
        aim: Vec3?,
        kind: AimKind,
    ): OverlayState {
        fun project(p: Vec3) = MeasureMath.projectToScreen(viewProj, p, width, height)
        fun segment(a: Vec3, b: Vec3) = MeasureMath.projectSegment(viewProj, a, b, width, height)
        fun onScreen(p: ScreenPoint) = p.x in 0f..width.toFloat() && p.y in 0f..height.toFloat()

        // The shape as it would be after the tap (room plan after closing: the corners).
        val shape = ArrayList(live.points)
        val roomClosed = mode == MeasureMode.ROOM_PLAN && flow.closed
        val preview = live.preview
        if (preview != null && !roomClosed) {
            if (live.replacesLast && shape.isNotEmpty()) shape[shape.lastIndex] = preview else shape.add(preview)
        }

        val points = (live.points + listOfNotNull(live.wallTop)).mapNotNull { project(it) }
        // Show where the point lands when it isn't under the reticle (vertical aim, snapped box side).
        val previewDot =
            if (aim != null && preview != null && MeasureMath.distance(aim, preview) > 0.005) project(preview) else null

        val lines = ArrayList<OverlayLine>()
        val labels = ArrayList<OverlayLabel>()
        fun addLabel(lengthM: Double, seg: ScreenSegment?) {
            val mid = seg?.midpoint ?: return
            if (onScreen(mid)) labels.add(OverlayLabel(LengthFormat.format(lengthM, unit), mid))
        }

        var fill: List<ScreenPoint>? = null
        var arc: AngleArc? = null
        var labelAt: ScreenPoint? = null
        var labelCentered = false

        if (mode == MeasureMode.VOLUME) {
            val corners = OverlayGeometry.boxCorners(shape)
            for ((i, j) in OverlayGeometry.boxEdges(corners.size)) {
                segment(corners[i], corners[j])?.let { lines.add(OverlayLine(it)) }
            }
            if (corners.size >= 4) {
                val base = corners.take(4).map { project(it) }
                if (base.all { it != null }) fill = base.filterNotNull()
                // Length, width and height on the three measured sides.
                for ((i, j) in listOf(0 to 1, 1 to 2, 2 to 6)) {
                    if (j < corners.size) addLabel(MeasureMath.distance(corners[i], corners[j]), segment(corners[i], corners[j]))
                }
                labelAt = OverlayGeometry.centroid(corners.mapNotNull { project(it) })
                labelCentered = true
            } else if (lines.size == 1) {
                labelAt = lines[0].segment.midpoint
            }
        } else {
            val projected = live.segments.map { it to segment(it.a, it.b) }
            for ((s, seg) in projected) {
                if (seg != null) lines.add(OverlayLine(seg, dashed = s.kind == SegmentKind.CLOSING))
            }
            val smallLabels =
                (mode == MeasureMode.PATH || mode == MeasureMode.AREA || mode == MeasureMode.ROOM_PLAN) &&
                    live.segments.size >= 2
            if (smallLabels) {
                for ((s, seg) in projected) addLabel(s.lengthM, seg)
            }
            if ((mode == MeasureMode.AREA || mode == MeasureMode.ROOM_PLAN) && shape.size >= 3) {
                val polygon = shape.map { project(it) }
                if (polygon.all { it != null }) fill = polygon.filterNotNull()
            }
            if (mode == MeasureMode.ANGLE && shape.size == 3) {
                val v = project(shape[1])
                val a = project(shape[0])
                val b = project(shape[2])
                if (v != null && a != null && b != null) arc = OverlayGeometry.angleArc(v, a, b)
            }
            when (live.valueKind) {
                ValueKind.ANGLE ->
                    arc?.let {
                        labelAt = OverlayGeometry.arcLabelPoint(it, (MeasureOverlayView.ARC_RADIUS_DP + ANGLE_LABEL_GAP_DP) * density)
                        labelCentered = true
                    }
                ValueKind.AREA -> {
                    labelAt = OverlayGeometry.centroid(shape.mapNotNull { project(it) })
                    labelCentered = true
                }
                // One line: label its middle. A path's total sits above the controls.
                else -> if (projected.size == 1) labelAt = projected[0].second?.midpoint
            }
        }

        val guide =
            if (aim != null && kind == AimKind.VERTICAL) {
                flow.verticalBase()?.let { base -> segment(base, base + MeasureMath.UP * MeasureMath.MAX_VERTICAL_M) }
            } else {
                null
            }

        return OverlayState(
            points = points,
            preview = previewDot,
            lines = lines,
            fill = fill,
            guide = guide,
            arc = arc,
            segmentLabels = labels,
            label = live.value?.let { formatValue(it, live.valueKind) },
            labelPosition = labelAt,
            labelCentered = labelCentered,
        )
    }

    private fun formatValue(value: Double, kind: ValueKind): String =
        when (kind) {
            ValueKind.LENGTH -> LengthFormat.format(value, unit)
            ValueKind.AREA -> LengthFormat.area(value, unit)
            ValueKind.VOLUME -> LengthFormat.volume(value, unit)
            ValueKind.ANGLE -> LengthFormat.angle(value)
        }

    private fun findAim(
        frame: Frame,
        width: Int,
        height: Int,
        invViewProj: FloatArray?,
        cameraPosition: Vec3,
        kind: AimKind,
    ): Vec3? {
        // Screen centre is (0, 0) in normalised device coordinates.
        val ray = invViewProj?.let { MeasureMath.screenRay(it, 0f, 0f) }
        if (kind == AimKind.VERTICAL) {
            val base = flow.verticalBase() ?: return null
            return ray?.let { MeasureMath.verticalAim(base, it) }
        }
        val floorOnly = kind == AimKind.FLOOR
        val plane = currentLockedPlane(floorOnly)
        if (plane != null && ray != null) {
            val center = plane.centerPose
            val hit = MeasureMath.intersectRayPlane(ray, toVec(center), Vec3.of(center.yAxis))
            if (hit != null) return hit
            // Ray parallel to the plane or pointing away: fall back to a hit test.
        }
        for (hit in frame.hitTest(width / 2f, height / 2f)) {
            val trackable = hit.trackable as? Plane ?: continue
            val pose = hit.hitPose
            if (trackable.trackingState != TrackingState.TRACKING) continue
            if (trackable.subsumedBy != null) continue
            if (floorOnly && trackable.type != Plane.Type.HORIZONTAL_UPWARD_FACING) continue
            if (!trackable.isPoseInPolygon(pose)) continue
            // Skip hits seen from behind the plane.
            if (MeasureMath.signedDistanceToPlane(cameraPosition, toVec(pose), Vec3.of(pose.yAxis)) <= 0f) continue
            if (lockedPlane == null) {
                lockedPlane = trackable
                listener.onPlaneLocked()
            }
            return toVec(pose)
        }
        return null
    }

    /**
     * The locked plane, following merges (subsumedBy); unlocks it if ARCore stopped tracking it, or
     * if [floorOnly] and it isn't a floor.
     */
    private fun currentLockedPlane(floorOnly: Boolean): Plane? {
        var plane = lockedPlane ?: return null
        while (true) plane = plane.subsumedBy ?: break
        if (plane.trackingState == TrackingState.STOPPED ||
            (floorOnly && plane.type != Plane.Type.HORIZONTAL_UPWARD_FACING)
        ) {
            lockedPlane = null
            return null
        }
        lockedPlane = plane
        return plane
    }

    private fun progressHint(kind: AimKind): String =
        when {
            closeSnap -> texts.closeRoom
            flow.pointCount == 0 && lockedPlane == null -> if (kind == AimKind.FLOOR) texts.aimFloor else texts.coaching
            else -> texts.progress[flow.progressKey()] ?: texts.coaching
        }

    private fun trackingHint(reason: TrackingFailureReason): String =
        when (reason) {
            TrackingFailureReason.INSUFFICIENT_LIGHT -> texts.tooDark
            TrackingFailureReason.EXCESSIVE_MOTION -> texts.tooFast
            TrackingFailureReason.INSUFFICIENT_FEATURES -> texts.lowTexture
            TrackingFailureReason.CAMERA_UNAVAILABLE -> texts.cameraBusy
            else -> texts.gettingReady
        }

    private fun toVec(pose: Pose) = Vec3(pose.tx(), pose.ty(), pose.tz())

    private companion object {
        const val TAG = "MeasureSession"

        /** How close (dp) the aim must come to the first corner on screen to close a room. */
        const val CLOSE_SNAP_DP = 36f

        /** Gap (dp) between the angle arc and its label's centre. */
        const val ANGLE_LABEL_GAP_DP = 30f
    }
}

/** Pure screen and drawing helpers for the overlay (no ARCore, so they run in JUnit). */
object OverlayGeometry {
    /**
     * Box corners from volume points [A, B, C, T]: 2 points -> [A, B]; 3 -> the floor rectangle
     * [A, B, C, D] with D = A + (C - B); 4 -> that rectangle and the same lifted by T - C.
     */
    fun boxCorners(shape: List<Vec3>): List<Vec3> {
        if (shape.size < 3) return shape.toList()
        val a = shape[0]
        val b = shape[1]
        val c = shape[2]
        val base = listOf(a, b, c, a + (c - b))
        if (shape.size < 4) return base
        val lift = shape[3] - c
        return base + base.map { it + lift }
    }

    /** Edges (index pairs) for [boxCorners] output of [count] corners. */
    fun boxEdges(count: Int): List<Pair<Int, Int>> =
        when {
            count >= 8 -> RECT.flatMap { (i, j) -> listOf(i to j, i + 4 to j + 4) } + (0 until 4).map { it to it + 4 }
            count >= 4 -> RECT
            count >= 2 -> listOf(0 to 1)
            else -> emptyList()
        }

    private val RECT = listOf(0 to 1, 1 to 2, 2 to 3, 3 to 0)

    /** Average of [points], or null if there are none. */
    fun centroid(points: List<ScreenPoint>): ScreenPoint? {
        if (points.isEmpty()) return null
        return ScreenPoint(points.map { it.x }.average().toFloat(), points.map { it.y }.average().toFloat())
    }

    /** The arc at [vertex] from the arm towards [a] to the arm towards [b] (the shorter way round). */
    fun angleArc(vertex: ScreenPoint, a: ScreenPoint, b: ScreenPoint): AngleArc? {
        if (MeasureMath.screenDistance(vertex, a) < 1f || MeasureMath.screenDistance(vertex, b) < 1f) return null
        val start = Math.toDegrees(atan2((a.y - vertex.y).toDouble(), (a.x - vertex.x).toDouble())).toFloat()
        val end = Math.toDegrees(atan2((b.y - vertex.y).toDouble(), (b.x - vertex.x).toDouble())).toFloat()
        var sweep = (end - start) % 360f
        if (sweep > 180f) sweep -= 360f
        if (sweep <= -180f) sweep += 360f
        return AngleArc(vertex, start, sweep)
    }

    /** The point [distancePx] from the arc's centre, halfway along the arc. */
    fun arcLabelPoint(arc: AngleArc, distancePx: Float): ScreenPoint {
        val mid = Math.toRadians((arc.startDeg + arc.sweepDeg / 2f).toDouble())
        return ScreenPoint(arc.center.x + (cos(mid) * distancePx).toFloat(), arc.center.y + (sin(mid) * distancePx).toFloat())
    }
}
