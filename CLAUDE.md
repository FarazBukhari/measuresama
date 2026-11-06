# Measure Sama: rules for Claude

Free AR tape measure. Vite + React 19 + TypeScript + Tailwind 4, Capacitor 8, Vitest, Playwright, oxlint. Local Capacitor plugin `ArMeasure` (Kotlin + ARCore on Android, Swift + ARKit on iOS). Read [docs/lessons.md](docs/lessons.md) before planning.

## Commands

Run Node through the wrapper, from the repo root (`.nvmrc` is 22):

```
~/.claude/bin/with-node npm run lint
~/.claude/bin/with-node npm run typecheck
~/.claude/bin/with-node npm test
~/.claude/bin/with-node npm run build
E2E_DEV=1 PORT=<free port> ~/.claude/bin/with-node npx playwright test
```

Android (from `android/`; Gradle needs JDK 21, `java` on PATH is 17):

```
JAVA_HOME=$HOME/Library/Java/JavaVirtualMachines/jdk-21.0.13+9/Contents/Home \
ANDROID_HOME=$HOME/Library/Android/sdk \
./gradlew assembleDebug testDebugUnitTest --no-daemon --max-workers=2
```

If Maven Central answers 429, pass an init script that mirrors `mavenCentral()` to `https://maven-central.storage-download.googleapis.com/maven2/`. Never launch the emulator; device tests run in CI.

## Layout

- `src/pages/`: Home, AR entry (`/ar`), ruler, history, settings.
- `src/modes/catalog.ts`: the modes catalog. How to add a mode: [docs/MODE_GUIDE.md](docs/MODE_GUIDE.md).
- `src/plugins/ar-measure/`: the plugin contract (`definitions.ts`) and web fallback. Native code must match it exactly: `android/.../ar/ArMeasurePlugin.kt`, `ios/App/App/ArMeasurePlugin.swift`.
- Android renderer: small OpenGL ES camera background plus a 2D Canvas overlay. No SceneView, Filament or Sceneform. Depth is off.
- `docs/PLAN.md`: state, roadmap, accuracy notes, phone checklist.

## Rules

- UI text is for regular people, not developers. Plain, short, no jargon.
- Everything stays on the phone. No network calls, no analytics.
- Save files only through `src/lib/download.ts`.
- Ask Faraz before anything delicate: licence, making the repo public, store accounts, signing keys or keystores, monetization SDKs.
- App id `com.foxysama.measuresama` never changes after the first store release.
- Never copy Grymala (AR Ruler) code, assets, strings or branding. Ideas only, from `docs/research/ar-ruler-rea.md`.
- Never commit APKs, AABs or decompiled or extracted files.
- iOS cannot be built on this Mac. Never run `xcodebuild` or `pod install`. Mark every iOS change NOT BUILT OR TESTED.
- After adding a Capacitor plugin, run `npx cap sync android` and `npx cap sync ios`, and commit `android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle` and `ios/App/CapApp-SPM/Package.swift`.

## Git

- Commits are authored as Faraz Bukhari <fuz.bukhari@gmail.com>. No Claude attribution and no Co-Authored-By lines. If a hook asks to re-author as Claude, do not; tell Faraz.
- Never force-push.
- Work on a branch (`faraz-dev/<name>`). Let `ci.yml` and `android.yml` pass on it.
- Push to `main` only after Faraz approves, as a fast-forward: `git push origin <sha>:main`.
