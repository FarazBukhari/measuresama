# Measure Sama plan

## (a) Current state

Built:
- React shell: home mode picker (9 modes), AR pages (`/ar`, `/ar/:mode`) with fallback, photo measure (`/photo`), on-screen ruler (`/ruler`) with bank-card calibration, history v2 (per-mode rows and detail), settings, units (cm/in), share, CSV and JSON export, room plan PDF (jsPDF, in the web layer).
- `ArMeasure` plugin: typed TS contract in `src/plugins/ar-measure/`, web fallback. `checkAvailability().modes` lists what a build can start.
- Android: one mode-aware AR engine (Kotlin + ARCore): `MeasureFlow` (pure logic) + `MeasureSession` (GL-thread engine) + `MeasureOverlayView`. Surface search shows a scan animation, the aim circle has two states and + stays dimmed until the circle is on a surface. Depth is off.
- CI: `ci.yml` (lint, typecheck, unit, build, web e2e) and `android.yml` (APK, emulator device tests, no ARCore on the emulator).

| Mode | Android | iOS | Web |
|---|---|---|---|
| Distance | done | code written, **NOT BUILT OR TESTED** | fallback |
| Path, Area, Angle, Height, Volume, Room plan | done | not started (reports `modes: ['distance']`) | fallback |
| Photo measure | done (no AR) | same web code | done (no AR) |
| On-screen ruler | done | same web code | done |

Not yet checked on a real phone: every AR mode. Use the checklists in section (f).

**NOT BUILT OR TESTED: iOS.** Swift + ARKit/RealityKit code exists in `ios/App/App/` for distance only. There is no Xcode on the dev Mac and no cloud iOS build. Only a syntax parse and a plist lint were done. Expect compile fixes on the first Xcode build. Known weak spots: ARKit/RealityKit signatures (`ray(through:)`, `project(_:)`, `raycast`, `snapshot`), Swift 6 actor warnings, simulator guards, photo size, haptic rate, hint thresholds.

## (b) Roadmap

Each mode follows [MODE_GUIDE.md](MODE_GUIDE.md).

1. **Done on Android**: distance, height, angle, path, area & perimeter, volume, room plan + PDF.
2. **Done everywhere**: photo measure (bank card for scale), on-screen ruler.
3. **Next: phone testing.** Run every checklist in (f) and write the errors in the tables.
4. **Rectangle and circle**: still to do. Rectangle from two opposite corners on the plane, circle from centre and radius. Give width, height, area, perimeter.
5. **Later: iOS parity.** Port `MeasureFlow`, the engine and the overlay to Swift, report all modes in `modes`, then build in Xcode. **NOT BUILT OR TESTED** until then.

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

## (f) Test on your phone

Use an Android phone that supports ARCore. Install the APK from the `measuresama-apk` artifact of the Android workflow run.

### Every AR mode: first launch and surface search

- [ ] Home opens with 9 mode cards, no crash.
- [ ] Open the mode: "Checking your phone…", then "Start measuring". Camera prompt appears. Deny it: a plain message, no crash.
- [ ] Phone without Google Play Services for AR: the install/update prompt appears.
- [ ] While no surface is found: the scan animation shows and the hint says "Scan a surface".
- [ ] The aim circle has two looks: searching and on a surface. A haptic tick when it locks.
- [ ] The + button is dimmed until the circle is on a surface (floor, for floor modes).
- [ ] Tap + while off a surface: the circle shakes, the phone buzzes and "Aim at a surface" shows. Nothing is added.
- [ ] Undo, Clear and Save are dimmed when they can't act.
- [ ] Hints: cover the camera ("Too dark"), shake the phone ("Slow down").
- [ ] "Less accurate past 5 m" shows beyond 5 m.
- [ ] Background and come back mid-measure: no crash. Back closes the AR screen. Rotate: overlay stays correct.
- [ ] Switching cm/in in Settings changes the labels.
- [ ] After Save: History has the row with its photo. Open it: Share opens the share sheet. CSV and JSON export include it.

### Distance

- [ ] "Tap + to start", tap, "Tap + at the end", tap. Label shows cm or m. Save.
- [ ] Aim past the edge of the detected surface: it still measures.

### Path

- [ ] "Tap + to start", tap at every turn ("Tap + to add"). Total sits above the bottom bar, side labels on each part. Save. Detail shows Total and Parts.

### Area & perimeter

- [ ] Tap each corner in order ("Tap + on a corner", "Next corner"). The shape fills amber, the closing side is dashed. Label inside shows the area. Save. Detail shows Area and Perimeter.
- [ ] Try on a wall: it still works (one plane).

### Angle

- [ ] "Tap + on the corner" order: edge, corner, other edge. Arc and degrees show at the corner. Detail shows Angle and Side 1, Side 2.

### Height

- [ ] Floor only for the first tap ("Tap + at the bottom"). Then "Raise to the top": a dashed vertical line follows the aim. Tap at the top. Detail shows Height.

### Volume

- [ ] Two floor corners (length), then the width (snaps square to the first side), then raise to the top. Box shows. Detail shows Volume (L under 1 m³), Size, other unit, Base.

### Room plan + PDF

- [ ] Floor only. Tap each corner ("Tap + on a corner"). The circle snaps to the first corner: "Tap + to close", haptic tick. Then "Set wall height" (optional). Save.
- [ ] Detail draws the SVG plan with wall numbers and lengths. Save PDF: a file named `room-plan-YYYY-MM-DD.pdf` in Documents > Measure Sama. Open it: plan, area, perimeter, walls.

### Photo measure (no AR)

- [ ] Put a bank card flat on a table next to the object. "Take photo" opens the camera, or use "Choose photo".
- [ ] Drag the 4 corners onto the card. The magnifier shows while dragging. Lines stay blocked until the card is a usable shape.
- [ ] Add a line, drag its ends along the object. Length shows. "Swap sides" if the card is read the wrong way round.
- [ ] Save: opens the detail with the photo. A photo that isn't an image shows "Can’t open this photo".

### Errors

Write down the reading and the error (Reading minus Real).

| Mode | Measured object | Real | Reading | Error |
|---|---|---|---|---|
| Distance | Bank card long side | 85.6 mm | | |
| Distance | Floor tape | 1000 mm | | |
| Path | Tape bent into an L (500 + 500) | 1000 mm | | |
| Area | A4 sheet on a table | 623.7 cm² | | |
| Area | Floor tile or rug | measured with tape | | |
| Angle | Corner of a book or room | 90.0° | | |
| Height | Door | 2030 mm (check yours) | | |
| Height | Tape stood on the floor | 1000 mm | | |
| Volume | Moving box | measured with tape | | |
| Room plan | Room (area, perimeter) | measured with tape | | |
| Photo | Bank card long side (no AR) | 85.6 mm | | |
| Photo | A4 long side, card beside it | 297 mm | | |
