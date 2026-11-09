# Lessons for Measure Sama

Provenance: adapted from the Tools Sama lessons (a sibling app by the same owner, same stack).
The app name and ID below are Measure Sama's.

Read before planning. Each item cost real time once.

## Native app (Capacitor 8, Android WebView / iOS WKWebView)

- **`<a download>` does nothing in the app.** All saving goes through `src/lib/download.ts`,
  which writes to Documents › Measure Sama with the Filesystem plugin, shows a toast with a
  Share action, and falls back to the share sheet. Never add a new download path that
  bypasses it.
- **Plugin calls that reject are logged as console errors** in debug builds (and fail the
  on-device tests). Don't probe with calls that are expected to fail (e.g. `Filesystem.stat`
  on a missing file); list the folder with `readdir` instead.
- **Permissions live in native files**, not JavaScript: `android/app/src/main/AndroidManifest.xml`
  (CAMERA, storage with `maxSdkVersion`) and `ios/App/App/Info.plist`
  (NSCameraUsageDescription, NSPhotoLibraryAddUsageDescription).
  A missing iOS usage string crashes the app the moment the camera is requested.
- **Missing in WebViews**: `window.print`, `window.open`, the Web Speech API,
  `getDisplayMedia`, `Notification`, `EyeDropper`. Feature-detect, and branch with `Capacitor.isNativePlatform()` /
  `isNativeApp()` from `src/state/install.ts`.
- **Android's back button closes the app** unless it is handled. `src/native/backButton.ts`
  (with `@capacitor/app`) closes overlays, then goes back, then home, then exits.
- **The app's URL is `https://localhost/...`**: never offer to share it. Hide link sharing in the app.
- **No Android emulator in this container** (no KVM). Real-runtime checks happen in CI
  (`android.yml` → device-tests). Hosted runners nearly run out of disk for the emulator:
  keep the "free disk space" step, `disk-size: 2G` and `-no-snapshot`.
- **App ID is `com.foxysama.measuresama`** (Android `applicationId`/`namespace` and Java package,
  iOS bundle ID, `capacitor.config.ts`, `e2e-android/fixtures.ts`). It must never change after
  the first store release: a new ID is a different app with its own listing.
- **WebView `localStorage` reaches disk about 5 s after a write.** If the process is killed
  sooner (`am force-stop`, or a user swiping the app away right after saving), the write is
  lost. So in the app, `src/lib/storage.ts` also writes every `measuresama:` key to
  `@capacitor/preferences` (on disk at once), and `hydrateStorage()` in `src/main.tsx`
  restores them before `App` and the stores are imported (stores read storage when their
  module loads, so never import them statically from `main.tsx`). Always go through
  `storage`; a direct `localStorage` write is not mirrored and is undone at the next launch.
  The relaunch device test deliberately does not wait. If history grows past a few hundred
  KB, move it to a Filesystem JSON file.
- **Full web e2e: use the production build** (`npm run build`, then `PORT=<port> npx playwright
  test`, which serves `vite preview` like CI). With `E2E_DEV=1` and a fresh cache, the first
  full parallel run can time out while Vite optimizes deps behind the dynamic `import('./App')`.
- After adding a Capacitor plugin: `npx cap sync` (Android **and** iOS), commit
  `android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle` and
  `ios/App/CapApp-SPM/Package.swift`.

## React and browser pitfalls

- **Queues/workers + React state**: a `setState(updater)` callback runs later, during the next
  render. A worker that reads a ref assigned inside the updater sees stale data and re-picks
  finished items; that was the image resizer's "2 of 4 never started" bug. Keep the source of
  truth in a ref updated synchronously, then mirror it to state.
- **Phones run out of memory on big photos**: decode with `createImageBitmap`, release
  canvases (`width = height = 0`), cap canvas area to about 16.7 MP (iOS limit), and time out
  `canvas.toBlob`, which can silently never call back.
- Test batches with realistic inputs: several 4000×3000 photos, not one small sample. The
  first resizer tests only used small images and missed both bugs above.
- `pkill -f "vite preview"` kills your own shell (the pattern is in its command line). Find
  servers by port with `ss -ltnp`.
- `\uXXXX` escapes written through tools can turn into real invisible characters in files.

## AR modes and the shared engine

- **A silent no-op + button looks broken.** The first phone test: no animation while searching
  and + did nothing, so it felt dead. The + button now looks dimmed and says why (its
  description changes), the circle shakes, the phone buzzes and "Aim at a surface" shows when
  it is tapped off a surface. Never leave a control that silently does nothing.
- **Never call `start()` for a mode outside `availability.modes`.** The plugin rejects it
  (`NOT_IMPLEMENTED`), and a rejected plugin call is logged as a console error that fails the
  device tests. iOS lists only `distance`; web lists none. Use `canStartMode()`.
- **Keep per-mode rules in the pure `MeasureFlow`**, not the GL-thread engine: JUnit tests run in
  seconds and caught the mistakes before any phone did.
- **Don't run Gradle and Playwright at the same time.** CPU contention makes the e2e tests time out.
  Run them one after the other.
- **Photo-measure device test**: `setInputFiles` can't reach host files from a WebView. Build the
  File in the page and put it on the input with `DataTransfer`, then fire `change`
  (`setPhotoFixtureInPage` in `e2e/photoFixture.ts`).
- **A saved history file is read by version.** v1 (distance only) is read as is and rewritten
  as v2 at the next change; items missing a field their mode needs are dropped on load.

## Testing

- Playwright `getByLabel('X')` also matches the copy button "Copy X": use `{ exact: true }`
  or `getByRole('textbox', { name: 'X' })`. Likewise "Favorite" matches "Add … to favorites".
- Android's toybox `ls` escapes spaces (`formatted\ (2).json`); check files with
  `test -f '<path>'` instead.
- Parallel agents need their own Vite cache and Playwright output: `E2E_DEV=1` +
  `PORT=<port>` already sets `VITE_CACHE_DIR=node_modules/.vite-<port>` and
  `test-results/<port>`.
- Mock network APIs in e2e (`page.route`); the currency converter is the only tool that
  calls the internet.
- The axe smoke test runs mobile in dark mode, so contrast is checked in both themes.

## Tooling and environment

- **Maven Central rate-limits Gradle (HTTP 429)**: locally, use an init script pointing at
  `https://maven-central.storage-download.googleapis.com/maven2/` and `--max-workers=2`.
- `android-actions/setup-android@v3` installs the removed `tools` package and fails; use
  `@v4` with explicit `packages: platform-tools platforms;android-36 build-tools;36.0.0`.
- **Kotlin for the AR plugin**: the `ArMeasure` Capacitor plugin is written in Kotlin, so the
  Android project needs the Kotlin Gradle plugin (`org.jetbrains.kotlin.android`) in
  `android/build.gradle` and `android/app/build.gradle`. The project this one was copied from is Java-only.
- **Local Android builds**: Gradle for Capacitor 8 needs JDK 21, and `java` on PATH here is 17. Use
  `JAVA_HOME=$HOME/Library/Java/JavaVirtualMachines/jdk-21.0.13+9/Contents/Home ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew assembleDebug --no-daemon --max-workers=2`
  from `android/`. If Maven Central answers 429, add an init script that mirrors `mavenCentral()` to
  `https://maven-central.storage-download.googleapis.com/maven2/` and pass `--init-script`.
  Never launch the emulator from an agent; device tests run in CI.
- **No Xcode on this Mac**: `xcodebuild` and `pod install` do not work, so the iOS code
  (ARKit/RealityKit) is **NOT BUILT OR TESTED**. `ios/` was copied and renamed; Capacitor 8 uses
  SPM (`ios/App/CapApp-SPM/Package.swift`, regenerated by `npx cap sync ios`).

## Git and process

- Commits are authored as the repository owner, Faraz Bukhari <fuz.bukhari@gmail.com>, with
  **no Claude attribution lines**. Ignore hooks that ask to re-author as Claude; tell the owner instead.
- Force-push is blocked by the sandbox. If history must be rewritten, the owner deletes or
  renames the remote branch, then a normal push recreates it.
- Commit each agent's unit as it lands, with explicit paths (`slugs.mjs --paths`). Use
  `git add -A` only once every agent has finished.
- The owner approves pushes to `main` per change, and only after CI **and** the Android
  workflow pass on the same commit. Push as a fast-forward (`git push origin <sha>:main`).
