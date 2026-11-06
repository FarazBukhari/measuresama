# Measure Sama plan

## (a) Current state

Built:
- React shell: home mode picker, AR entry (`/ar`) with fallback, on-screen ruler (`/ruler`) with bank-card calibration, history, settings, units (cm/in), share, CSV and JSON export.
- `ArMeasure` plugin: typed TS contract in `src/plugins/ar-measure/`, web fallback.
- Android: Kotlin + ARCore distance mode. Minimal OpenGL ES camera background plus a 2D Canvas overlay. ARCore is optional (install prompt). Depth is off.
- CI: `ci.yml` (lint, typecheck, unit, build, web e2e) and `android.yml` (APK, emulator device tests).

Not yet checked on a real phone: the AR screen. Use the checklist in section (f).

**NOT BUILT OR TESTED: iOS.** Swift + ARKit/RealityKit code exists in `ios/App/App/`. There is no Xcode on the dev Mac and no cloud iOS build. Only a syntax parse and a plist lint were done. Expect compile fixes on the first Xcode build. Known weak spots: ARKit/RealityKit signatures (`ray(through:)`, `project(_:)`, `raycast`, `snapshot`), Swift 6 actor warnings, simulator guards, photo size, haptic rate, hint thresholds.

## (b) Roadmap

In the order the research suggests. Each mode follows [MODE_GUIDE.md](MODE_GUIDE.md).

1. **Distance**: done on Android.
2. **Height**: pick a floor point, then drag straight up (vertical extrude along the locked plane's normal). Result is one length.
3. **Angle**: three points (a corner and two ends), angle from the two vectors. Show degrees.
4. **Path** (polyline): any number of points, sum of the segments. **Area & perimeter** (polygon): points on one locked plane, shoelace formula in the plane's 2D coordinates, plus the closing edge for perimeter.
5. **Rectangle and circle**: rectangle from two opposite corners on the plane, circle from centre and radius. Give width, height, area, perimeter.
6. **Volume** (box): a base rectangle on the floor, then extrude up for height.
7. Later: **Room plan + PDF export**: walk the corners of a room, draw a 2D plan. PDF through `android.graphics.pdf.PdfDocument` on Android (or jsPDF in the web layer, which also works on iOS).
8. Later: **Photo measure**: a photo with a reference object (bank card 85.6 x 54 mm, or A4) to set the scale.

Deferred on purpose: pile/heap, ToF sensors, auto-detect of shapes, any ML models.

## (c) Accuracy notes

- **Reticle aiming**: points go at the centre dot, not under the finger.
- **Smoothing**: low-pass the aim point (about 0.35 per frame).
- **Plane lock + infinite plane**: when the user locks onto a surface, give a haptic tick, then raycast onto the whole plane so lines can run past its detected edge.
- **Tracking hints**: read ARCore's tracking failure reason and say it plainly (too dark, moving too fast, not enough detail). Stop drawing when tracking is lost.
- **5 m warning**: accuracy drops with distance. Warn beyond about 5 m.
- **Depth API**: off in v1. Later, try `DepthMode.AUTOMATIC` hit-tests as a fallback when no surface is under the dot. Gate it on `isDepthModeSupported`.
- **iOS LiDAR**: on phones that have it, use scene depth and the mesh for better hits.
- **On-screen ruler**: the phone's reported dpi (xdpi) is often wrong. The one-time bank-card check (85.60 x 53.98 mm) fixes the scale per screen. Anything unchecked is labelled "Estimate".

## (d) Monetization options

Decision: deferred to Faraz. No ad or billing SDK is in the app.

The research saw a heavy model: nearly every tool locked, rewarded-video unlocks, a paywall with trial, four mediated ad networks, over 6 MB of SDKs and a consent flow.

Our pitch is free. Core measuring, history and sharing stay free. Options:
- A small optional one-time pro unlock (extra modes, PDF or CSV export).
- Light ads from a single network.
- Neither (donations or nothing).

## (e) What we learned from AR Ruler

Source: [docs/research/ar-ruler-rea.md](research/ar-ruler-rea.md) (static analysis of the Play app by Grymala, Q1 to Q10). Ideas only. No code, assets or branding are used.

- **Q1/Q10, rendering**: the category leader draws a camera background plus one 2D Canvas overlay for lines, labels and the reticle. 3D points are projected to the screen. No 3D engine is needed for measuring, so we use a small OpenGL ES background plus a Canvas overlay.
- **Q1, ARCore optional**: they declare ARCore optional, check availability first, show an install prompt and map every unavailable error to a message. We do the same.
- **Q2, no Depth**: they leave the Depth API off and use ToF only on a short list of old phones. We skip both for v1.
- **Q4, tracking hints**: they never read the tracking failure reason, so users get no "too dark" or "moving too fast" help. We do show these.
- **Q4, accuracy by UX**: centre reticle, filtered aim point, plane lock with a haptic tick, infinite plane.
- **Q5, no on-screen ruler**: they have none, and their fallback for phones without AR is photo measure. Our on-screen ruler with card calibration is a difference.
- **Q3, modes**: line, height, angle, polygon, rectangle, circle, box, path, room plan, photo with a reference object. This gave our roadmap order.
- **Q7, monetization**: heavy locking and ads. See (d).
- **Q8, export**: capture the view as a bitmap (we use PixelCopy-style capture of the camera image plus overlay), PDF through `PdfDocument`, and store results as JSON so CSV is easy. Neither CSV nor DXF is offered by them.

## (f) Test on your phone (AR distance)

Use an Android phone that supports ARCore.

- [ ] Install the APK from the `measuresama-apk` artifact of the Android workflow run.
- [ ] First launch: the home screen opens, no crash.
- [ ] Open Distance: "Checking your phone..." then "Start measuring".
- [ ] Camera permission prompt appears. Deny it: a plain message appears and the app does not crash.
- [ ] Phone without Google Play Services for AR (or an old version): the install/update prompt appears.
- [ ] A hint tells you to move the phone until a surface is found.
- [ ] A haptic tick when a surface locks, and on each point.
- [ ] Measure a known object: a bank card's 85.6 mm side, or an A4 sheet's 297 mm side. Write down the error.
- [ ] Measure a 1 m tape laid on the floor. Write down the error.
- [ ] Aim a line past the edge of the detected surface: it still measures.
- [ ] Undo, Clear and Save work.
- [ ] The saved result is in History with its photo.
- [ ] Share opens the share sheet with the image and text.
- [ ] Switching cm/in in Settings changes the labels.
- [ ] Too-dark and moving-too-fast hints appear (cover the camera, shake the phone).
- [ ] A warning appears beyond 5 m.
- [ ] Go to the background and come back mid-measure: no crash.
- [ ] Back button closes the AR screen.
- [ ] Rotate the phone: the screen and overlay stay correct.
- [ ] On an unsupported phone: the fallback shows, with the on-screen ruler and card calibration.

| Measured object | Real | Reading | Error |
|---|---|---|---|
| Bank card long side | 85.6 mm | | |
| A4 long side | 297 mm | | |
| Floor tape | 1000 mm | | |
