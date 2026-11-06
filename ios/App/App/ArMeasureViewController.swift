// NOT BUILT OR TESTED: written without Xcode. Expect fixes on the first build on a Mac with Xcode.
//
// Full-screen AR distance screen (ARKit + RealityKit ARView).
// Centre-reticle aiming, smoothed aim point, plane lock with a haptic tick,
// then points measured on the infinite locked plane. Lines and labels are a
// 2D overlay re-projected every frame, so they stay crisp at any distance.

import Foundation
import UIKit
import ARKit
import RealityKit
import simd

struct ArScreenshotFile {
    let url: URL
    let width: Int
    let height: Int
}

enum ArMeasureOutcome {
    case measured(points: [SIMD3<Float>], distanceM: Double, screenshot: ArScreenshotFile?, createdAt: Date)
    case cancelled(reason: String, message: String?)
}

// RealityKit's ARView has no ARKit session in the simulator SDK.
#if !targetEnvironment(simulator)

final class ArMeasureViewController: UIViewController, ARSessionDelegate {
    private let unit: String
    private var completion: ((ArMeasureOutcome) -> Void)?

    private let arView: ARView
    private let coachingOverlay = ARCoachingOverlayView()
    /// Everything in here is drawn into the saved photo.
    private let overlayView = UIView()
    private let lineLayer = CAShapeLayer()
    private let dotsLayer = CAShapeLayer()
    private let distanceLabel = PaddedLabel()
    private let reticle = UIView()
    private let hintLabel = PaddedLabel()

    private lazy var closeButton = makeButton(
        title: "Close", symbol: "xmark", accessibility: "Close and go back", prominent: false)
    private lazy var undoButton = makeButton(
        title: "Undo", symbol: "arrow.uturn.backward", accessibility: "Undo last point", prominent: false)
    private lazy var clearButton = makeButton(
        title: "Clear", symbol: "trash", accessibility: "Clear all points", prominent: false)
    private lazy var addButton = makeButton(
        title: "Add point", symbol: "plus", accessibility: "Add point at the dot", prominent: true)
    private lazy var saveButton = makeButton(
        title: "Save", symbol: "checkmark", accessibility: "Save measurement", prominent: true)

    private let haptics = UIImpactFeedbackGenerator(style: .light)

    // State (main thread only)
    private var pointAnchors: [ARAnchor] = []
    private var aimPoint: SIMD3<Float>?
    private var aimDistanceFromCamera: Float = 0
    private var candidatePlaneID: UUID?
    private var candidatePlane: MeasurePlane?
    private var lockedPlaneID: UUID?
    private var lockedPlane: MeasurePlane?
    private var trackingNormal = false
    private var sessionStarted = false
    private var isSaving = false
    private var finished = false

    private static let brandIndigo = UIColor(red: 0x37 / 255.0, green: 0x30 / 255.0, blue: 0xA3 / 255.0, alpha: 1)
    private static let lowLightLumens: CGFloat = 200

    init(unit: String, completion: @escaping (ArMeasureOutcome) -> Void) {
        self.unit = unit
        self.completion = completion
        self.arView = ARView(frame: .zero, cameraMode: .ar, automaticallyConfigureSession: false)
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
        isModalInPresentation = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override var prefersStatusBarHidden: Bool { true }

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setUpViews()
        updateButtons()
        hintLabel.text = "Move your phone slowly to find a flat surface."
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // Run after presentation so a fast failure can dismiss cleanly.
        guard !sessionStarted, !finished else { return }
        sessionStarted = true
        runSession()
        haptics.prepare()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        arView.session.pause()
    }

    private func runSession() {
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal, .vertical]
        config.isLightEstimationEnabled = true
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            // LiDAR: the mesh makes .estimatedPlane raycasts much better.
            config.sceneReconstruction = .mesh
        }
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
            config.frameSemantics.insert(.sceneDepth)
        }
        arView.session.delegate = self
        arView.session.run(config, options: [.resetTracking, .removeExistingAnchors])
    }

    // MARK: - Views

    private func setUpViews() {
        arView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(arView)

        overlayView.translatesAutoresizingMaskIntoConstraints = false
        overlayView.isUserInteractionEnabled = false
        overlayView.backgroundColor = .clear
        view.addSubview(overlayView)

        for layer in [lineLayer, dotsLayer] {
            layer.strokeColor = UIColor.white.cgColor
            layer.lineWidth = 3
            layer.lineCap = .round
            layer.shadowColor = UIColor.black.cgColor
            layer.shadowOpacity = 0.6
            layer.shadowRadius = 2
            layer.shadowOffset = .zero
            overlayView.layer.addSublayer(layer)
        }
        lineLayer.fillColor = UIColor.clear.cgColor
        dotsLayer.fillColor = UIColor.white.cgColor
        dotsLayer.strokeColor = Self.brandIndigo.cgColor
        dotsLayer.lineWidth = 2

        distanceLabel.font = .monospacedDigitSystemFont(ofSize: 20, weight: .semibold)
        distanceLabel.textColor = .white
        distanceLabel.backgroundColor = UIColor.black.withAlphaComponent(0.75)
        distanceLabel.layer.cornerRadius = 10
        distanceLabel.layer.masksToBounds = true
        distanceLabel.textAlignment = .center
        distanceLabel.isHidden = true
        distanceLabel.isAccessibilityElement = true
        overlayView.addSubview(distanceLabel)

        // Centre reticle: ring + dot. Not part of the saved photo.
        reticle.translatesAutoresizingMaskIntoConstraints = false
        reticle.isUserInteractionEnabled = false
        reticle.isAccessibilityElement = false
        reticle.layer.cornerRadius = 16
        reticle.layer.borderWidth = 2
        reticle.layer.borderColor = UIColor.white.withAlphaComponent(0.6).cgColor
        let reticleDot = UIView()
        reticleDot.translatesAutoresizingMaskIntoConstraints = false
        reticleDot.backgroundColor = .white
        reticleDot.layer.cornerRadius = 3
        reticle.addSubview(reticleDot)
        view.addSubview(reticle)

        coachingOverlay.translatesAutoresizingMaskIntoConstraints = false
        coachingOverlay.session = arView.session
        coachingOverlay.goal = .anyPlane
        coachingOverlay.activatesAutomatically = true
        view.addSubview(coachingOverlay)

        // Hints and controls sit above the coaching overlay so Close always works.
        hintLabel.translatesAutoresizingMaskIntoConstraints = false
        hintLabel.font = .preferredFont(forTextStyle: .callout)
        hintLabel.adjustsFontForContentSizeCategory = true
        hintLabel.textColor = .white
        hintLabel.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        hintLabel.layer.cornerRadius = 12
        hintLabel.layer.masksToBounds = true
        hintLabel.numberOfLines = 0
        hintLabel.textAlignment = .center
        view.addSubview(hintLabel)

        view.addSubview(closeButton)

        let bottomBar = UIStackView(arrangedSubviews: [undoButton, clearButton, addButton, saveButton])
        bottomBar.translatesAutoresizingMaskIntoConstraints = false
        bottomBar.axis = .horizontal
        bottomBar.alignment = .center
        bottomBar.distribution = .fillEqually
        bottomBar.spacing = 8
        view.addSubview(bottomBar)

        closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        undoButton.addTarget(self, action: #selector(undoTapped), for: .touchUpInside)
        clearButton.addTarget(self, action: #selector(clearTapped), for: .touchUpInside)
        addButton.addTarget(self, action: #selector(addTapped), for: .touchUpInside)
        saveButton.addTarget(self, action: #selector(saveTapped), for: .touchUpInside)

        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            arView.topAnchor.constraint(equalTo: view.topAnchor),
            arView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            arView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            arView.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            overlayView.topAnchor.constraint(equalTo: arView.topAnchor),
            overlayView.bottomAnchor.constraint(equalTo: arView.bottomAnchor),
            overlayView.leadingAnchor.constraint(equalTo: arView.leadingAnchor),
            overlayView.trailingAnchor.constraint(equalTo: arView.trailingAnchor),

            coachingOverlay.topAnchor.constraint(equalTo: view.topAnchor),
            coachingOverlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            coachingOverlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            coachingOverlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            reticle.centerXAnchor.constraint(equalTo: arView.centerXAnchor),
            reticle.centerYAnchor.constraint(equalTo: arView.centerYAnchor),
            reticle.widthAnchor.constraint(equalToConstant: 32),
            reticle.heightAnchor.constraint(equalToConstant: 32),
            reticleDot.centerXAnchor.constraint(equalTo: reticle.centerXAnchor),
            reticleDot.centerYAnchor.constraint(equalTo: reticle.centerYAnchor),
            reticleDot.widthAnchor.constraint(equalToConstant: 6),
            reticleDot.heightAnchor.constraint(equalToConstant: 6),

            closeButton.topAnchor.constraint(equalTo: safe.topAnchor, constant: 8),
            closeButton.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 12),

            hintLabel.topAnchor.constraint(equalTo: closeButton.bottomAnchor, constant: 12),
            hintLabel.centerXAnchor.constraint(equalTo: safe.centerXAnchor),
            hintLabel.leadingAnchor.constraint(greaterThanOrEqualTo: safe.leadingAnchor, constant: 16),
            hintLabel.trailingAnchor.constraint(lessThanOrEqualTo: safe.trailingAnchor, constant: -16),
            hintLabel.widthAnchor.constraint(lessThanOrEqualToConstant: 480),

            bottomBar.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 12),
            bottomBar.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -12),
            bottomBar.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -12)
        ])
    }

    private func makeButton(title: String, symbol: String, accessibility: String, prominent: Bool) -> UIButton {
        var config = UIButton.Configuration.filled()
        config.title = title
        config.image = UIImage(systemName: symbol)
        config.imagePlacement = .top
        config.imagePadding = 4
        config.cornerStyle = .large
        config.baseForegroundColor = .white
        config.baseBackgroundColor = prominent ? Self.brandIndigo : UIColor.black.withAlphaComponent(0.65)
        config.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 10, bottom: 8, trailing: 10)
        config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            outgoing.font = UIFont.preferredFont(forTextStyle: .footnote)
            return outgoing
        }
        let button = UIButton(configuration: config)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.accessibilityLabel = accessibility
        NSLayoutConstraint.activate([
            button.heightAnchor.constraint(greaterThanOrEqualToConstant: 56),
            button.widthAnchor.constraint(greaterThanOrEqualToConstant: 44)
        ])
        return button
    }

    // MARK: - ARSessionDelegate

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard !finished else { return }
        if case .normal = frame.camera.trackingState {
            trackingNormal = true
        } else {
            trackingNormal = false
        }
        updateAim(frame)
        updateOverlay(frame)
        updateHint(frame)
        updateButtons()
    }

    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        // ARKit keeps refining planes; follow the locked one.
        guard let lockedID = lockedPlaneID else { return }
        for case let plane as ARPlaneAnchor in anchors where plane.identifier == lockedID {
            if let refined = MeasurePlane(transform: plane.transform) {
                lockedPlane = refined
            }
        }
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        if let arError = error as? ARError, arError.code == .cameraUnauthorized {
            finish(.cancelled(
                reason: "permission-denied",
                message: "Camera access is off. You can turn it on in Settings > Measure Sama."))
            return
        }
        finish(.cancelled(reason: "ar-unavailable", message: "AR stopped working. Please try again."))
    }

    func sessionWasInterrupted(_ session: ARSession) {
        finish(.cancelled(reason: "ar-unavailable", message: "The camera was interrupted. Please try again."))
    }

    // MARK: - Aiming

    private func updateAim(_ frame: ARFrame) {
        guard trackingNormal else {
            // Stop drawing while tracking is paused.
            aimPoint = nil
            return
        }
        let centre = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
        var raw: SIMD3<Float>?

        // After point A: measure on the infinite locked plane, so lines can run past the detected patch.
        if let plane = lockedPlane, let ray = arView.ray(through: centre) {
            raw = MeasureMath.intersect(rayOrigin: ray.origin, rayDirection: ray.direction, plane: plane)
        }

        if raw == nil {
            if let hit = arView.raycast(from: centre, allowing: .existingPlaneGeometry, alignment: .any).first {
                raw = MeasureMath.position(of: hit.worldTransform)
                if let planeAnchor = hit.anchor as? ARPlaneAnchor {
                    if planeAnchor.identifier != candidatePlaneID {
                        // Plane lock: tick so people feel the surface "grab".
                        haptics.impactOccurred()
                        haptics.prepare()
                    }
                    candidatePlaneID = planeAnchor.identifier
                    candidatePlane = MeasurePlane(transform: planeAnchor.transform)
                } else {
                    candidatePlaneID = nil
                    candidatePlane = nil
                }
            } else if let hit = arView.raycast(from: centre, allowing: .estimatedPlane, alignment: .any).first {
                raw = MeasureMath.position(of: hit.worldTransform)
                candidatePlaneID = nil
                candidatePlane = nil
            } else {
                candidatePlaneID = nil
                candidatePlane = nil
            }
        }

        guard let target = raw else {
            aimPoint = nil
            return
        }
        let smoothed = MeasureMath.smooth(previous: aimPoint, target: target)
        aimPoint = smoothed
        aimDistanceFromCamera = MeasureMath.distance(smoothed, MeasureMath.position(of: frame.camera.transform))
    }

    private func currentPosition(of anchor: ARAnchor, in frame: ARFrame) -> SIMD3<Float> {
        let latest = frame.anchors.first { $0.identifier == anchor.identifier } ?? anchor
        return MeasureMath.position(of: latest.transform)
    }

    // MARK: - Overlay

    private func updateOverlay(_ frame: ARFrame) {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        defer { CATransaction.commit() }

        reticle.layer.borderColor = (aimPoint == nil
            ? UIColor.white.withAlphaComponent(0.4)
            : (candidatePlaneID != nil || lockedPlane != nil ? Self.brandIndigo : UIColor.white)).cgColor

        guard trackingNormal else {
            lineLayer.path = nil
            dotsLayer.path = nil
            distanceLabel.isHidden = true
            return
        }

        let placed = pointAnchors.map { currentPosition(of: $0, in: frame) }
        var ends = placed
        let isLive = placed.count == 1
        if isLive, let aim = aimPoint {
            ends.append(aim)
        }

        let camera = frame.camera.transform
        let screen: [CGPoint?] = ends.map { point in
            MeasureMath.isInFront(point, cameraTransform: camera) ? arView.project(point) : nil
        }

        let dots = UIBezierPath()
        for (index, point) in screen.enumerated() where index < placed.count {
            if let p = point {
                dots.append(UIBezierPath(ovalIn: CGRect(x: p.x - 6, y: p.y - 6, width: 12, height: 12)))
            }
        }
        dotsLayer.path = dots.cgPath

        guard ends.count == 2, let a = screen[0], let b = screen[1] else {
            lineLayer.path = nil
            distanceLabel.isHidden = true
            return
        }

        let line = UIBezierPath()
        line.move(to: a)
        line.addLine(to: b)
        lineLayer.path = line.cgPath
        lineLayer.lineDashPattern = isLive ? [8, 6] : nil

        let metres = Double(MeasureMath.distance(ends[0], ends[1]))
        let text = LengthFormat.label(metres: metres, unit: unit)
        if distanceLabel.text != text {
            distanceLabel.text = text
            distanceLabel.accessibilityLabel = "Distance \(text)"
            distanceLabel.sizeToFit()
        }
        distanceLabel.center = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 28)
        distanceLabel.isHidden = false
    }

    // MARK: - Hints

    private func updateHint(_ frame: ARFrame) {
        let text: String
        switch frame.camera.trackingState {
        case .notAvailable:
            text = "Getting the camera ready. Hold your phone steady."
        case .limited(let reason):
            switch reason {
            case .initializing:
                text = "Getting ready. Move your phone slowly from side to side."
            case .excessiveMotion:
                text = "Slow down. Move your phone more gently."
            case .insufficientFeatures:
                text = "Point at something with more detail, or turn on more light."
            case .relocalizing:
                text = "Finding your place again. Point back where you started."
            @unknown default:
                text = "Hold on, the camera is still getting ready."
            }
        case .normal:
            if let light = frame.lightEstimate, light.ambientIntensity < Self.lowLightLumens {
                text = "It's quite dark. More light makes measuring more accurate."
            } else if aimPoint == nil {
                text = "Aim the dot at a flat surface."
            } else if aimDistanceFromCamera > MeasureMath.farWarningDistance {
                text = "That's more than 5 m away, so the result may be less accurate. Move closer if you can."
            } else {
                switch pointAnchors.count {
                case 0: text = "Aim the dot at the start and tap Add point."
                case 1: text = "Now aim at the end and tap Add point."
                default: text = "Tap Save to keep this measurement."
                }
            }
        }
        if hintLabel.text != text {
            hintLabel.text = text
        }
    }

    // MARK: - Buttons

    private func updateButtons() {
        let count = pointAnchors.count
        setEnabled(undoButton, count > 0 && !isSaving)
        setEnabled(clearButton, count > 0 && !isSaving)
        setEnabled(addButton, count < 2 && aimPoint != nil && trackingNormal && !isSaving)
        setEnabled(saveButton, count == 2 && !isSaving)
        setEnabled(closeButton, !isSaving)
    }

    private func setEnabled(_ button: UIButton, _ enabled: Bool) {
        if button.isEnabled != enabled {
            button.isEnabled = enabled
            button.alpha = enabled ? 1 : 0.5
        }
    }

    @objc private func closeTapped() {
        finish(.cancelled(reason: "user", message: nil))
    }

    @objc private func addTapped() {
        guard pointAnchors.count < 2, trackingNormal, let point = aimPoint else { return }
        let anchor = ARAnchor(name: "measure-point", transform: MeasureMath.translation(point))
        arView.session.add(anchor: anchor)
        pointAnchors.append(anchor)
        if pointAnchors.count == 1 {
            // Lock the plane under point A (if any) for point B.
            lockedPlaneID = candidatePlaneID
            lockedPlane = candidatePlane
        }
        haptics.impactOccurred()
        haptics.prepare()
        if pointAnchors.count == 2 {
            let metres = Double(MeasureMath.distance(
                MeasureMath.position(of: pointAnchors[0].transform),
                MeasureMath.position(of: pointAnchors[1].transform)))
            UIAccessibility.post(
                notification: .announcement,
                argument: "Distance \(LengthFormat.label(metres: metres, unit: unit))")
        } else {
            UIAccessibility.post(notification: .announcement, argument: "Start point added")
        }
        updateButtons()
    }

    @objc private func undoTapped() {
        guard let last = pointAnchors.popLast() else { return }
        arView.session.remove(anchor: last)
        if pointAnchors.isEmpty {
            unlockPlane()
        }
        updateButtons()
    }

    @objc private func clearTapped() {
        for anchor in pointAnchors {
            arView.session.remove(anchor: anchor)
        }
        pointAnchors.removeAll()
        unlockPlane()
        updateButtons()
    }

    private func unlockPlane() {
        lockedPlaneID = nil
        lockedPlane = nil
    }

    // MARK: - Save

    @objc private func saveTapped() {
        guard pointAnchors.count == 2, !isSaving, !finished else { return }
        let points: [SIMD3<Float>]
        if let frame = arView.session.currentFrame {
            points = pointAnchors.map { currentPosition(of: $0, in: frame) }
        } else {
            points = pointAnchors.map { MeasureMath.position(of: $0.transform) }
        }
        let distance = Double(MeasureMath.distance(points[0], points[1]))
        let createdAt = Date()
        isSaving = true
        updateButtons()

        arView.snapshot(saveToHDR: false) { [weak self] image in
            DispatchQueue.main.async {
                guard let self = self else { return }
                let photo = image.map { self.composite($0) }
                DispatchQueue.global(qos: .userInitiated).async {
                    let file = photo.flatMap { Self.writeJPEG($0) }
                    DispatchQueue.main.async {
                        self.finish(.measured(
                            points: points, distanceM: distance, screenshot: file, createdAt: createdAt))
                    }
                }
            }
        }
    }

    /// Camera snapshot + 2D overlay, at most 1600 px on the long side. Main thread.
    private func composite(_ snapshot: UIImage) -> UIImage {
        let size = arView.bounds.size
        let longest = max(size.width, size.height, 1)
        let format = UIGraphicsImageRendererFormat()
        format.opaque = true
        format.scale = min(traitCollection.displayScale, 1600 / longest)
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        return renderer.image { context in
            snapshot.draw(in: CGRect(origin: .zero, size: size))
            overlayView.layer.render(in: context.cgContext)
        }
    }

    /// Library/NoCloud/measurements/<uuid>.jpg (app-private, not backed up).
    private static func writeJPEG(_ image: UIImage) -> ArScreenshotFile? {
        guard let data = image.jpegData(compressionQuality: 0.85), let cg = image.cgImage else { return nil }
        do {
            let fm = FileManager.default
            let library = try fm.url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            var noCloud = library.appendingPathComponent("NoCloud", isDirectory: true)
            try fm.createDirectory(at: noCloud, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? noCloud.setResourceValues(values)
            let folder = noCloud.appendingPathComponent("measurements", isDirectory: true)
            try fm.createDirectory(at: folder, withIntermediateDirectories: true)
            let file = folder.appendingPathComponent("\(UUID().uuidString.lowercased()).jpg")
            try data.write(to: file, options: .atomic)
            return ArScreenshotFile(url: file, width: cg.width, height: cg.height)
        } catch {
            return nil
        }
    }

    // MARK: - Finish

    private func finish(_ outcome: ArMeasureOutcome) {
        guard !finished else { return }
        finished = true
        arView.session.pause()
        coachingOverlay.setActive(false, animated: false)
        let done = completion
        completion = nil
        if presentingViewController != nil {
            dismiss(animated: true) { done?(outcome) }
        } else {
            done?(outcome)
        }
    }
}

/// UILabel with padding, used for the hint and the distance badge.
private final class PaddedLabel: UILabel {
    var insets = UIEdgeInsets(top: 6, left: 12, bottom: 6, right: 12)

    override func textRect(forBounds bounds: CGRect, limitedToNumberOfLines numberOfLines: Int) -> CGRect {
        let inner = super.textRect(forBounds: bounds.inset(by: insets), limitedToNumberOfLines: numberOfLines)
        return inner.inset(by: UIEdgeInsets(
            top: -insets.top, left: -insets.left, bottom: -insets.bottom, right: -insets.right))
    }

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: insets))
    }
}

#endif
