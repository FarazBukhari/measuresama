# Measure Sama

A free AR tape measure for your phone. Point the camera, tap two points and read the distance in cm or inches. Phones without AR get an on-screen ruler instead. Everything stays on the phone.

App id: `com.foxysama.measuresama` (never changes).

## Status

- Android: AR distance mode (ARCore). Built and unit tested, but not yet checked on a real phone. See the checklist in [docs/PLAN.md](docs/PLAN.md).
- On-screen ruler with bank-card calibration, history, units, settings, share and CSV/JSON export: done.
- Other modes (height, angle, path, area, volume, room plan, photo): coming soon. They show a "Coming soon" badge.
- iOS: ARKit/RealityKit code is written but **NOT BUILT OR TESTED**. There is no Xcode and no cloud iOS build yet.

## Run the web app

```
~/.claude/bin/with-node npm install
~/.claude/bin/with-node npm run dev
```

The web version has no AR. It shows the fallback and the on-screen ruler.

## Build for Android

```
npm run build && npx cap sync android
cd android
JAVA_HOME=<JDK 21> ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

- Gradle needs JDK 21. See [CLAUDE.md](CLAUDE.md) for the local paths and the Maven mirror tip.
- AR needs a real phone that ARCore supports, with Google Play Services for AR. The emulator only shows the fallback.
- CI also builds the APK and attaches it as the `measuresama-apk` artifact.

## Build for iOS

Needs a Mac with Xcode. **NOT BUILT OR TESTED.**

```
npm run build && npx cap sync ios
```

Open `ios/App` in Xcode, set the signing team, then run on a real iPhone (AR does not work in the simulator).

## Tests

| Check | Command | Runs |
|---|---|---|
| Lint (oxlint) | `npm run lint` | local, `ci.yml` |
| Typecheck | `npm run typecheck` | local, `ci.yml` |
| Unit tests (Vitest) | `npm test` | local, `ci.yml` |
| Web e2e + axe accessibility, mobile, light and dark (Playwright) | `npm run test:e2e` | local, `ci.yml` |
| Android APK build | `cd android && ./gradlew assembleDebug` | local, `android.yml` |
| Android unit tests (Kotlin) | `./gradlew testDebugUnitTest` | local |
| Emulator device tests (Playwright on Android) | `npm run test:android` | `android.yml` only |
| AR on a real phone | manual checklist in [docs/PLAN.md](docs/PLAN.md) | by hand |

`ci.yml` runs on every push and pull request. `android.yml` runs on `main`, `faraz-dev/**` and `v*` tags.

## Layout

```
src/pages/            Home, AR entry, ruler, history, settings
src/modes/            Mode catalog and the on-screen ruler
src/plugins/ar-measure/   ArMeasure plugin: TS contract + web fallback
src/state/, src/lib/  Settings, history, units, downloads
android/app/src/main/java/com/foxysama/measuresama/ar/   Kotlin + ARCore
ios/App/App/          Swift + ARKit (NOT BUILT OR TESTED)
e2e/, e2e-android/    Web and device tests
docs/                 PLAN, MODE_GUIDE, lessons, research
```

## Licence

None yet (private repo).
