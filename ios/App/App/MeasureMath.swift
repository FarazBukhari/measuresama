// NOT BUILT OR TESTED: written without Xcode. Expect fixes on the first build on a Mac with Xcode.
//
// Pure geometry helpers for the AR distance mode (Foundation + simd only).

import Foundation
import simd

/// An infinite plane in AR world space (metres).
struct MeasurePlane: Equatable {
    let point: SIMD3<Float>
    /// Unit length.
    let normal: SIMD3<Float>

    init?(point: SIMD3<Float>, normal: SIMD3<Float>) {
        let length = simd_length(normal)
        guard length.isFinite, length > 1e-6 else { return nil }
        self.point = point
        self.normal = normal / length
    }

    /// ARKit plane anchors (and raycast results) use the transform's local Y axis as the surface normal.
    init?(transform: simd_float4x4) {
        let y = transform.columns.1
        self.init(point: MeasureMath.position(of: transform), normal: SIMD3<Float>(y.x, y.y, y.z))
    }
}

enum MeasureMath {
    /// Low-pass weight for the newest aim sample.
    static let smoothingAlpha: Float = 0.35
    /// Jumps bigger than this snap straight to the new point instead of sliding across the room.
    static let smoothingResetDistance: Float = 0.25
    /// Ignore plane hits further than this; grazing angles give huge, useless distances.
    static let maxRayDistance: Float = 20
    /// Past this the hint warns that accuracy drops.
    static let farWarningDistance: Float = 5

    static func position(of transform: simd_float4x4) -> SIMD3<Float> {
        let c = transform.columns.3
        return SIMD3<Float>(c.x, c.y, c.z)
    }

    static func translation(_ point: SIMD3<Float>) -> simd_float4x4 {
        var t = matrix_identity_float4x4
        t.columns.3 = SIMD4<Float>(point.x, point.y, point.z, 1)
        return t
    }

    static func distance(_ a: SIMD3<Float>, _ b: SIMD3<Float>) -> Float {
        simd_distance(a, b)
    }

    /// Ray / infinite plane intersection. Nil when the ray is (nearly) parallel,
    /// points away from the plane, or hits it further than `maxDistance`.
    static func intersect(
        rayOrigin: SIMD3<Float>,
        rayDirection: SIMD3<Float>,
        plane: MeasurePlane,
        maxDistance: Float = maxRayDistance
    ) -> SIMD3<Float>? {
        let dirLength = simd_length(rayDirection)
        guard dirLength > 1e-6 else { return nil }
        let dir = rayDirection / dirLength
        let denom = simd_dot(plane.normal, dir)
        guard abs(denom) > 1e-4 else { return nil }
        let t = simd_dot(plane.point - rayOrigin, plane.normal) / denom
        guard t.isFinite, t >= 0, t <= maxDistance else { return nil }
        return rayOrigin + dir * t
    }

    /// Exponential low-pass filter for the aim point.
    static func smooth(
        previous: SIMD3<Float>?,
        target: SIMD3<Float>,
        alpha: Float = smoothingAlpha,
        resetDistance: Float = smoothingResetDistance
    ) -> SIMD3<Float> {
        guard let previous = previous, simd_distance(previous, target) <= resetDistance else {
            return target
        }
        let a = min(max(alpha, 0), 1)
        return previous + (target - previous) * a
    }

    /// True when `point` is in front of the camera (ARKit cameras look down their local -Z).
    static func isInFront(_ point: SIMD3<Float>, cameraTransform: simd_float4x4) -> Bool {
        let z = cameraTransform.columns.2
        let forward = -SIMD3<Float>(z.x, z.y, z.z)
        return simd_dot(point - position(of: cameraTransform), forward) > 0.01
    }
}
