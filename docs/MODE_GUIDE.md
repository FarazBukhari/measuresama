# Adding a measuring mode

A mode is one way to measure (distance, height, angle...). Today only `distance` is built.
Modes are listed in `src/modes/catalog.ts` in roadmap order. The AR contract is in
`src/plugins/ar-measure/definitions.ts`.

## Golden rules

1. Everything runs on the phone. No network.
2. Plain language. "Tap to add a point", not "Anchor created". Hints for regular people.
3. Never crash. Expected outcomes (back pressed, permission denied, AR unavailable) resolve
   as `{ cancelled: true, reason }`. Only bad arguments and unexpected errors reject.
4. Users see the same number everywhere: AR screen, result, history, share and export.
5. Accessible: every control has a label and a target of at least 44 pt.

## Steps

1. **Catalog entry.** In `src/modes/catalog.ts`, set the mode's `status` to `'available'` and
   give it a `path`. Add the page route in `src/App.tsx` and a page in `src/pages/`.
   Until then it stays `'coming-soon'` and never calls the plugin.
2. **`ArMode` value.** The mode id must already be in the `ArMode` union in `definitions.ts`.
   If it is a new id, add it there and in the Kotlin and Swift copies.
3. **Plugin stays `NOT_IMPLEMENTED` until done.** `start()` rejects any mode other than
   `distance` with code `NOT_IMPLEMENTED` and the message "This measuring mode is coming soon."
   Change that check in the web fallback, `ArMeasurePlugin.kt` and `ArMeasurePlugin.swift`
   only when the native screen works.
4. **Native Android.** Add the mode to the AR screen in `android/.../ar/` (hit tests and
   matrix maths on the GL thread only; see the header comment in `ArMeasureActivity.kt`).
   Keep pure maths in `MeasureMath.kt` so it can be unit tested.
5. **Native iOS.** Same in `ios/App/App/` (`ArMeasureViewController.swift`, `MeasureMath.swift`).
   Mark the change NOT BUILT OR TESTED.
6. **Result shape.** Extend `ArMeasurement` in `definitions.ts` (the `mode` field, `points`,
   and a result field such as `areaM2`). All values in metres or square metres. Update
   `isArMeasurement`, the Kotlin JSON builder and the Swift one together.
7. **History.** Teach `src/state/history.ts` to store the new fields (keep `version: 1`
   readable or bump the version and ignore old data safely). Render it in
   `HistoryPage.tsx` and `HistoryDetailPage.tsx`, and add columns to CSV and JSON export.
8. **Tests.**
   - Vitest: pure logic, the plugin web fallback, history storage.
   - Web e2e (`e2e/`): the entry page, fallback and history rendering, including axe.
   - Device test (`e2e-android/`): the emulator has no AR, so test the fallback and any
     new text. Real AR checks go in the manual checklist in `docs/PLAN.md`.
   - Native unit tests for the maths (`android/app/src/test/.../ar/`).
9. **Docs.** Update the roadmap in `docs/PLAN.md` and the manual checklist.

## Copy rules

- Short sentences, everyday words. Say "phone", "surface", "point". Avoid "plane",
  "anchor", "tracking", "session", "ARCore" (except where the user must install Google Play
  Services for AR).
- Tell the user what to do next: "Move your phone slowly so it can find the floor."
- Errors say what happened and what to try, never a code.
- Amber is never text on light backgrounds (contrast). Use the design tokens.

## Length formatting contract

The web `formatLength` (`src/lib/units.ts`) and the native formatters (`LengthFormat.kt`,
`LengthFormat.swift`) must agree.

- Metric: under 1 m, one decimal and " cm". From 1 m, two decimals and " m".
- Imperial: round total inches to 0.1 first. Under 12 gives "X.X in". Otherwise "F ft R.R in"
  (F is whole feet, R is the rest, one decimal).

| Metres | Unit | Label |
|---|---|---|
| 0.1234 | cm | 12.3 cm |
| 1.2345 | cm | 1.23 m |
| 0.2 | in | 7.9 in |
| 0.3045 | in | 1 ft 0.0 in |
| 1.2345 | in | 4 ft 0.6 in |

Any new unit or rule needs the same test vectors in Vitest, Kotlin and Swift.
