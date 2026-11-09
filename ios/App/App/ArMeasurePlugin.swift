// NOT BUILT OR TESTED: written without Xcode. Expect fixes on the first build on a Mac with Xcode.
//
// App-local Capacitor plugin "ArMeasure" (iOS side). Contract must match
// src/plugins/ar-measure (TS) and android ArMeasurePlugin.kt exactly.
// Expected outcomes (close, camera denied, AR stopped) RESOLVE as { cancelled: true };
// checkAvailability and requestInstall never reject.

import Foundation
import UIKit
import AVFoundation
import ARKit
import Capacitor

@objc(ArMeasurePlugin)
public class ArMeasurePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ArMeasurePlugin"
    public let jsName = "ArMeasure"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkAvailability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestInstall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)
    ]

    private static let knownModes: Set<String> = [
        "distance", "path", "area", "angle", "height", "volume", "room-plan", "photo"
    ]
    private static let knownUnits: Set<String> = ["cm", "in"]
    private static let unsupportedReason = "This phone can't run AR."

    /// Main thread only. True from the start() call until the AR screen has closed.
    private var isBusy = false

    // MARK: - Availability

    private func isArSupported() -> Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        return ARWorldTrackingConfiguration.isSupported
        #endif
    }

    private func availabilityPayload() -> [String: Any] {
        let supported = isArSupported()
        var result: [String: Any] = [
            "status": supported ? "supported" : "unsupported",
            "platform": "ios",
            "lidar": supported && ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh),
            "modes": ["distance"]
        ]
        if !supported {
            result["reason"] = Self.unsupportedReason
        }
        return result
    }

    @objc func checkAvailability(_ call: CAPPluginCall) {
        call.resolve(availabilityPayload())
    }

    /// Nothing to install on iOS: resolve the current status.
    @objc func requestInstall(_ call: CAPPluginCall) {
        call.resolve(["status": isArSupported() ? "supported" : "unsupported"])
    }

    // MARK: - Start

    @objc func start(_ call: CAPPluginCall) {
        guard let mode = call.getString("mode"), Self.knownModes.contains(mode) else {
            call.reject("Unknown measuring mode.", "INVALID_ARGUMENT")
            return
        }
        guard let unit = call.getString("unit"), Self.knownUnits.contains(unit) else {
            call.reject("Unit must be 'cm' or 'in'.", "INVALID_ARGUMENT")
            return
        }
        // Other AR modes are Android-only for now; JS checks availability.modes first.
        // iOS parity is a later phase (docs/PLAN.md). NOT BUILT OR TESTED.
        guard mode == "distance" else {
            call.reject("This measuring mode is coming soon.", "NOT_IMPLEMENTED")
            return
        }
        guard isArSupported() else {
            call.reject(Self.unsupportedReason, "UNAVAILABLE")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard !self.isBusy else {
                call.reject("The measuring screen is already open.", "BUSY")
                return
            }
            self.isBusy = true
            self.ensureCameraAccess { granted in
                guard granted else {
                    self.isBusy = false
                    call.resolve(Self.cancelledPayload(
                        reason: "permission-denied",
                        message: "Camera access is off. You can turn it on in Settings > Measure Sama."
                    ))
                    return
                }
                self.presentMeasureScreen(call: call, unit: unit)
            }
        }
    }

    /// Calls back on the main thread.
    private func ensureCameraAccess(_ done: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            done(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async { done(granted) }
            }
        case .denied, .restricted:
            done(false)
        @unknown default:
            done(false)
        }
    }

    /// Main thread only.
    private func presentMeasureScreen(call: CAPPluginCall, unit: String) {
        #if targetEnvironment(simulator)
        isBusy = false
        call.reject(Self.unsupportedReason, "UNAVAILABLE")
        #else
        guard var host = bridge?.viewController else {
            isBusy = false
            call.reject("Couldn't open the measuring screen.", "INTERNAL")
            return
        }
        while let presented = host.presentedViewController, !presented.isBeingDismissed {
            host = presented
        }
        let screen = ArMeasureViewController(unit: unit) { [weak self] outcome in
            self?.isBusy = false
            call.resolve(Self.payload(for: outcome, unit: unit))
        }
        screen.modalPresentationStyle = .fullScreen
        host.present(screen, animated: true)
        #endif
    }

    // MARK: - Payloads

    private static func cancelledPayload(reason: String, message: String?) -> [String: Any] {
        var result: [String: Any] = ["cancelled": true, "reason": reason]
        if let message = message {
            result["message"] = message
        }
        return result
    }

    private static func payload(for outcome: ArMeasureOutcome, unit: String) -> [String: Any] {
        switch outcome {
        case let .cancelled(reason, message):
            return cancelledPayload(reason: reason, message: message)
        case let .measured(points, distanceM, screenshot, createdAt):
            var result: [String: Any] = [
                "cancelled": false,
                "mode": "distance",
                "unit": unit,
                "points": points.map { p -> [String: Any] in
                    ["x": Double(p.x), "y": Double(p.y), "z": Double(p.z)]
                },
                "distanceM": distanceM,
                "createdAt": isoTimestamp(createdAt)
            ]
            if let shot = screenshot {
                result["screenshot"] = [
                    "uri": shot.url.absoluteString,
                    "width": shot.width,
                    "height": shot.height,
                    "mimeType": "image/jpeg"
                ] as [String: Any]
            }
            return result
        }
    }

    /// ISO 8601 UTC with milliseconds, e.g. 2026-11-06T12:34:56.789Z (same shape as JS toISOString).
    private static func isoTimestamp(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}
