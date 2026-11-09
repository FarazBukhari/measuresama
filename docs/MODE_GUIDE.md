# Adding a measuring mode

A mode is one way to measure. All 7 AR modes (distance, path, area, angle, height, volume,
room plan) run on one shared engine. Photo measure and the on-screen ruler are web-only.
Modes are listed in `src/modes/catalog.ts`. The contract is in
`src/plugins/ar-measure/definitions.ts` (source of truth for Kotlin and Swift).

## Golden rules

1. Everything runs on the phone. No network.
2. Plain, very short text. "Tap + to start", not "Anchor created". People skim: 2 to 4 words per hint.
3. Never crash. Expected outcomes (back pressed, permission denied, AR unavailable) resolve
   as `{ cancelled: true, reason }`. Only bad arguments and unexpected errors reject.
4. Users see the same number everywhere: AR screen, result, history, share, export, PDF.
5. Accessible: every control has a label and a target of at least 44 pt.

## How the engine fits together (Android)

| Piece | File (`android/.../ar/`) | Job |
|---|---|---|
| `MeasureFlow` | `MeasureFlow.kt` | Pure Kotlin, no Android. Per-mode rules: how many points, what the aim must hit (`aimKind()`: SURFACE, FLOOR, VERTICAL), undo, clear, close, the live numbers and `result()`. Tested with JUnit. |
| `MeasureSession` | `MeasureSession.kt` | The GL-thread engine. ARCore frames, hit tests, anchors per point, smoothing, snapping, hints. Rebuilds the flow from anchor positions every frame. One add, undo or clear per frame. |
| Overlay | `MeasureOverlayView.kt` | Draws points, lines, fill, angle arc, labels and the aim circle for the current mode. `drawForCapture` leaves out the reticle for the saved photo. |
| Scan animation | `ScanAnimationView.kt` | Shown while no surface is found. |
| Maths | `MeasureMath.kt`, `LengthFormat.kt` | Pure maths and label formats. |
| Fields | `MeasurementFields` (in the activity file) | Builds each mode's result JSON. Pure, tested. |
| Activity | `ArMeasureActivity.kt` | Reads `EXTRA_MODE`, buttons, mode chip, result JSON. |

Maths and ARCore calls stay on the GL thread (see the header comment in `ArMeasureActivity.kt`).

## Steps for a new mode

1. **Contract.** Add the id to `ArMode` and a variant to the `ArMeasurement` union in
   `definitions.ts` (`mode`, `points`, result fields). Values in metres, m², m³, degrees.
   Update `isArMeasurement`. Native rounds to 5 decimals (angle to 3).
2. **Flow.** Add the mode to `MeasureFlow` (point count, `aimKind()`, `result()`). Write JUnit
   tests first: they are the cheapest place to find bugs.
3. **Engine and overlay.** Teach `MeasureSession` any new aim or snap rule, and
   `MeasureOverlayView` what to draw. Add `MeasurementFields` output and its test.
4. **Availability guard.** Add the mode to the list `checkAvailability()` returns in
   `ArMeasurePlugin.kt` (`modes`). JS calls `start({ mode })` only when status is `supported`
   AND the mode is in `modes` (a missing `modes` means `['distance']`). Never call `start()`
   for a mode outside that list: it rejects with `NOT_IMPLEMENTED` and the rejection is logged
   as a console error. iOS lists only `distance` until Swift catches up.
5. **Web page copy.** Add title, intro and up to 3 tips (6 words each) to `src/modes/ar/modeCopy.ts`.
6. **Catalog.** Add the entry and `path` in `catalog.ts` (`/ar/<mode>`). The route `/ar/:mode` already exists.
7. **Results.** Add the mode to `src/modes/results/summary.ts` (`resultSummary`: main value and
   short extras; `shareText` uses it). History rows, the detail page, share, CSV and PDF all read
   from this one module, so the number is the same everywhere.
8. **History v2.** In `src/state/history.ts` add the fields the mode needs to `REQUIRED` (an item
   missing one is dropped on load), and add a CSV column if it has a new quantity. v1 items
   (distance only) are read as they are and saved as v2 at the next change.
9. **iOS.** Same in `ios/App/App/`. Mark it NOT BUILT OR TESTED.
10. **Tests.**
    - Vitest: summary, history, units, plugin web fallback.
    - Web e2e (`e2e/modes.spec.ts`, `smoke.spec.ts`): seed a v2 item, check row and detail values, CSV, fallback page, axe.
    - Device test (`e2e-android/app.spec.ts`): the emulator has no ARCore, so check the page
      shows its h1 and the fallback. Real AR goes in the phone checklist in `docs/PLAN.md`.
    - Kotlin: `MeasureFlowTest`, `MeasurementFieldsTest`, `OverlayGeometryTest`, `LengthFormatTest`.
11. **Docs.** Update `docs/PLAN.md` (state, checklist, error table) and `README.md`.

## Result union

`ArMeasurement` is a union on `mode`. Every variant has `cancelled: false`, `mode`, `unit`,
`points`, `createdAt` and optional `screenshot`.

| Mode | Points | Fields |
|---|---|---|
| distance | A, B | `distanceM` |
| path | P1..Pn (n >= 2) | `segmentsM`, `distanceM` (sum) |
| area | P1..Pn (n >= 3, one plane) | `segmentsM` (n, last closes), `perimeterM`, `areaM2`, `distanceM` = perimeter |
| angle | A, V (corner), B | `angleDeg` (0..180), `segmentsM` [AV, BV] |
| height | base, top | `heightM`, `distanceM` |
| volume | A, B, C, T | `lengthM`, `widthM`, `heightM`, `areaM2`, `volumeM3` |
| room-plan | C1..Cn (n >= 3) | `segmentsM`, `perimeterM`, `areaM2`, `wallHeightM?`, `distanceM` |

Photo measure is not sent to the plugin. It saves straight to history with `photo`
(`imageWidth`, `imageHeight`, `card` of 4 points, `lines` with `lengthM`), `points: []` and
`distanceM` = first line.

## History v2 and CSV

`{ version: 2, items }` under `measuresama:history`, through `src/lib/storage.ts`. Required
fields per mode are in `REQUIRED` in `history.ts`. CSV has one row per item and one column
per quantity: Date, Mode, Length (m), Length, Unit, Area (m²), Perimeter (m), Angle (°),
Height (m), Width (m), Volume (m³), Wall height (m), Segments (m), Note, Photo. JSON export is
the same file plus `app` and `exportedAt`.

## Copy rules

- Short sentences, everyday words. Say "phone", "surface", "point". Avoid "plane",
  "anchor", "tracking", "session", "ARCore" (except where the user must install Google Play
  Services for AR).
- Tell the user what to do next: "Tap + to start".
- Errors say what happened and what to try, never a code.
- Amber is never text on light backgrounds (contrast). Use the design tokens.

## Formatting contract

`src/lib/units.ts` and `LengthFormat.kt` (and `LengthFormat.swift`) must agree. Rounding is
JS `toFixed` / `Math.round` (half up). Invalid input (NaN, Infinity, negative) gives "—" on
the web and 0 on native.

- Length, metric: under 1 m, one decimal and " cm". From 1 m, two decimals and " m".
- Length, imperial: round total inches to 0.1 first. Under 12 gives "X.X in". Otherwise "F ft R.R in".
- Area, cm: under 1 m² `round(m² × 10000) cm²`, else `m².toFixed(2) m²`. in: sq ft = m² / 0.09290304; under 1 sq ft `round(m² / 0.00064516) sq in`, else `sqft.toFixed(2) sq ft`.
- Volume, cm: under 1 m³ `round(m³ × 1000) L`, else `m³.toFixed(2) m³`. in: `(m³ / 0.028316846592).toFixed(2) ft³`.
- Angle: `deg.toFixed(1)°`.

| Value | Unit | Label |
|---|---|---|
| 0.1234 m | cm | 12.3 cm |
| 1.2345 m | cm | 1.23 m |
| 0.2 m | in | 7.9 in |
| 0.3045 m | in | 1 ft 0.0 in |
| 1.2345 m | in | 4 ft 0.6 in |
| 0.085 m² | cm | 850 cm² |
| 2.5 m² | cm | 2.50 m² |
| 2.5 m² | in | 26.91 sq ft |
| 0.25 m³ | cm | 250 L |
| 1.5 m³ | cm | 1.50 m³ |
| 0.25 m³ | in | 8.83 ft³ |
| 90° | any | 90.0° |
| 45.04° | any | 45.0° |

Any new unit or rule needs the same vectors in Vitest, Kotlin and Swift.
