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

/** UI actions, queued on the main thread and run on the GL thread at the start of the next frame. */
enum class Command { ADD_POINT, UNDO, CLEAR, SAVE }

/** A finished measurement: anchor positions (metres, AR world space) when Save ran. */
data class SaveData(val points: List<Vec3>, val distanceM: Double)

/** Plain-language texts for the hint line, resolved from strings.xml on the main thread. */
data class HintTexts(
    val coaching: String,
    val surfaceFound: String,
    val aimEnd: String,
    val done: String,
    val tooDark: String,
    val tooFast: String,
    val lowTexture: String,
    val cameraBusy: String,
    val gettingReady: String,
    val farWarning: String,
)

/**
 * Two-point distance measuring. GL THREAD ONLY: every method here touches ARCore objects
 * (frame, planes, anchors), so it must run inside onDrawFrame, apart from [detachAll], which the
 * activity calls in onDestroy after the GL thread has been paused.
 *
 * Aiming: the reticle sits at the screen centre. Until a surface is locked, ARCore hit tests are
 * used, accepting only tracked, non-subsumed planes where the hit lies inside the plane polygon.
 * The first such hit locks that plane. After that, the centre ray is intersected with the locked
 * plane extended to infinity, so a line can run past the area ARCore has detected.
 */
class MeasureSession(
    private val unit: String,
    private val texts: HintTexts,
    private val listener: Listener,
) {
    /** Events for the activity. Called on the GL thread; implementations post to the main thread. */
    interface Listener {
        fun onPlaneLocked()

        fun onPointAdded()

        fun onSaveReady(data: SaveData)

        fun onSaveUnavailable()
    }

    private var lockedPlane: Plane? = null
    private val anchors = ArrayList<Anchor>(2)
    private var smoothedAim: Vec3? = null
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
        anchors.removeAll { anchor ->
            val stopped = anchor.trackingState == TrackingState.STOPPED
            if (stopped) anchor.detach()
            stopped
        }

        if (!tracking || width <= 0 || height <= 0) {
            // Stop drawing points and lines until tracking is back; say why.
            smoothedAim = null
            return OverlayState(
                tracking = false,
                hint = trackingHint(camera.trackingFailureReason),
                pointCount = anchors.size,
                planeLocked = lockedPlane != null,
            )
        }

        camera.getProjectionMatrix(projectionMatrix, 0, MeasureMath.NEAR, MeasureMath.FAR)
        camera.getViewMatrix(viewMatrix, 0)
        val viewProj = MeasureMath.multiply(projectionMatrix, viewMatrix)
        val cameraPosition = toVec(camera.pose)

        val aim = findAim(frame, width, height, MeasureMath.invert(viewProj), cameraPosition)
        smoothedAim = aim?.let { MeasureMath.lowPass(smoothedAim, it) }
        val currentAim = smoothedAim

        val worldPoints = anchors.map { toVec(it.pose) }
        val screenPoints = worldPoints.mapNotNull { MeasureMath.projectToScreen(viewProj, it, width, height) }

        // A to B once both exist; while aiming B, a live line from A to the aim point.
        val segmentEnd =
            when {
                worldPoints.size >= 2 -> worldPoints[1]
                worldPoints.size == 1 -> currentAim
                else -> null
            }
        var line: ScreenSegment? = null
        var label: String? = null
        var distance = 0.0
        if (segmentEnd != null) {
            distance = MeasureMath.distance(worldPoints[0], segmentEnd)
            line = MeasureMath.projectSegment(viewProj, worldPoints[0], segmentEnd, width, height)
            if (line != null) label = LengthFormat.format(distance, unit)
        }
        val aimIsFar =
            currentAim != null && MeasureMath.distance(cameraPosition, currentAim) > MeasureMath.FAR_WARNING_M
        val tooFar = distance > MeasureMath.FAR_WARNING_M || aimIsFar

        return OverlayState(
            tracking = true,
            reticle = ScreenPoint(width / 2f, height / 2f),
            reticleState = if (currentAim != null) ReticleState.ON_SURFACE else ReticleState.SEARCHING,
            points = screenPoints,
            line = line,
            label = label,
            labelPosition = line?.midpoint,
            hint = progressHint(),
            warning = if (tooFar) texts.farWarning else null,
            pointCount = anchors.size,
            planeLocked = lockedPlane != null,
        )
    }

    /** Releases every anchor. Call only while the GL thread is paused or stopped. */
    fun detachAll() {
        anchors.forEach { it.detach() }
        anchors.clear()
        lockedPlane = null
        smoothedAim = null
    }

    private fun drainCommands(session: Session, commands: Queue<Command>, tracking: Boolean) {
        while (true) {
            when (commands.poll() ?: return) {
                Command.ADD_POINT -> if (tracking) addPoint(session)
                Command.UNDO -> if (anchors.isNotEmpty()) anchors.removeAt(anchors.lastIndex).detach()
                Command.CLEAR -> detachAll()
                Command.SAVE -> save()
            }
        }
    }

    private fun addPoint(session: Session) {
        val aim = smoothedAim ?: return
        val anchor =
            try {
                session.createAnchor(Pose.makeTranslation(aim.x, aim.y, aim.z))
            } catch (e: Exception) {
                // e.g. NotTrackingException if tracking dropped this instant: ignore the tap.
                Log.w(TAG, "Couldn't place a point", e)
                return
            }
        // A, then B; after that, a new tap moves B.
        if (anchors.size >= 2) anchors.removeAt(1).detach()
        anchors.add(anchor)
        listener.onPointAdded()
    }

    private fun save() {
        if (anchors.size < 2) {
            listener.onSaveUnavailable()
            return
        }
        val a = toVec(anchors[0].pose)
        val b = toVec(anchors[1].pose)
        listener.onSaveReady(SaveData(listOf(a, b), MeasureMath.distance(a, b)))
    }

    private fun findAim(
        frame: Frame,
        width: Int,
        height: Int,
        invViewProj: FloatArray?,
        cameraPosition: Vec3,
    ): Vec3? {
        val plane = currentLockedPlane()
        if (plane != null && invViewProj != null) {
            // Screen centre is (0, 0) in normalised device coordinates.
            val ray = MeasureMath.screenRay(invViewProj, 0f, 0f)
            if (ray != null) {
                val center = plane.centerPose
                val hit = MeasureMath.intersectRayPlane(ray, toVec(center), Vec3.of(center.yAxis))
                if (hit != null) return hit
            }
            // Ray parallel to the plane or pointing away: fall back to a hit test.
        }
        for (hit in frame.hitTest(width / 2f, height / 2f)) {
            val trackable = hit.trackable as? Plane ?: continue
            val pose = hit.hitPose
            if (trackable.trackingState != TrackingState.TRACKING) continue
            if (trackable.subsumedBy != null) continue
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

    /** The locked plane, following merges (subsumedBy); unlocks it if ARCore stopped tracking it. */
    private fun currentLockedPlane(): Plane? {
        var plane = lockedPlane ?: return null
        while (true) plane = plane.subsumedBy ?: break
        if (plane.trackingState == TrackingState.STOPPED) {
            lockedPlane = null
            return null
        }
        lockedPlane = plane
        return plane
    }

    private fun progressHint(): String =
        when {
            anchors.isEmpty() && lockedPlane == null -> texts.coaching
            anchors.isEmpty() -> texts.surfaceFound
            anchors.size == 1 -> texts.aimEnd
            else -> texts.done
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
    }
}
