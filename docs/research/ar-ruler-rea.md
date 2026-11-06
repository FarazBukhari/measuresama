# AR Ruler (Grymala): static reverse-engineering notes

Research input for Measure Sama. **Static analysis only**: nothing was installed, run, or pushed to a device. These notes record ideas and architecture only. They contain no copied code, assets, or bulk strings. UI text is paraphrased, with at most a few words quoted.

## Header

| Field | Value |
|---|---|
| Target | `com.grymala.aruler`, Play listing "AR Ruler" by Grymala |
| Version | versionName **3.3.6**, versionCode **2987** |
| SDK levels | minSdk 32, targetSdk 37, compileSdk 37 |
| Input | Genuine Play split set pulled from Faraz's phone: `base.apk` (43,164,680 B), `split_config.arm64_v8a.apk` (20.7 MB), `split_config.xxxhdpi.apk` (3.2 MB) |
| Date | 2026-11-06 |

### Provenance

| Check | apksigner 36.1.0 (run earlier by Faraz) | REA `inspect-apk-signature` (base.apk) |
|---|---|---|
| Schemes | v3 on all three splits | v2 **and** v3 present; v1 and v3.1 absent; v3 signer min_sdk 24 |
| Signer DN | CN=Pavel Prybytak, C=UK | `C=UK / CN=Pavel Prybytak`, serial `5152BCA0`, valid 2013-03-27 to 2113-03-03 |
| Cert SHA-256 | `a7b59ecb0039227b203354b9b30f64a9920e98f0ae5ba5f2d3a480cc8f8bd797` | same |
| Key | RSA 1024 | RSA (128-byte signature, consistent with 1024-bit) |
| Schemes agree / rotation | n/a | agree on signer; no rotation lineage |
| Content digest | verified | declared digest matches the bytes (REA does **not** verify signatures cryptographically) |
| Source stamp | present: CN=Android, O=Google Inc., SHA-256 `3257d599…bd6d`, RSA 4096 | present, same SHA-256 |

- Manifest stamp metadata: source is the Play Store, type is a distribution APK, splits required (`requiredSplitTypes base__abi,base__density`). **Verified**
- SHA-256 of the three files: base `b69ec8bd…dc30b`, arm64 `5579ba29…06215`, xxxhdpi `e1a55d49…582cf`.
- **Repack note:** a cracked "Premium" repack with the same versionCode also exists. Its signer DN is `C=IN` only, cert SHA-256 `3b61c2a8…628a`, and its minSdk was changed to 29. It was **not analysed** and is out of scope. The genuine build has an anti-tamper check (`AppSettings.b`): if the package name doesn't match, it shows a "pirate version" toast and exits. **Verified**

### Tools used

- **REA 6.8.0** (`npx rea-agents@latest`), running on Node 24.
  - Provider: JADX headless MCP 0.7.1 (bridge v7) on JDK 21.0.13.
  - Commands: `inspect-apk-signature`, `inspect-android-package`, `search-android-classes`, `inspect-android-class`, `inspect-android-method`, `trace-android-references`.
  - `decode-android-resources` **failed** because apktool isn't installed. aapt2 was used instead.
- **Android build-tools 36.1.0**: `aapt2 dump resources` / `aapt2 dump xmltree`, `dexdump` (plain plus `-d` bytecode for cross-referencing), and `apksigner` (earlier, by Faraz).
- `unzip -l` / `unzip -p`, `strings` (to identify `.so` files and dex strings), and `python3 -I` for JSON processing. The dex files were extracted to a scratch folder outside the repo, and only parsed.
- Ghidra was available but not needed.

### Obfuscation note

R8 renamed about 16k classes into the default package. **SourceFile attributes were kept**, though: obfuscated class `dz7` still reports `RulerType.java`. Most class-to-feature mapping in this doc uses those retained source-file names. A few names are wrong because R8 merged classes. For example, `km4` reports "InstantToolsAdsConfig.kt" but actually holds ExoPlayer caption code. Such cases were dropped.

## Source map

| Section | Evidence source |
|---|---|
| Header / provenance | REA `inspect-apk-signature base.apk`; `shasum`; manifest `com.android.stamp.*` |
| Q1, Q6, manifest facts | REA `inspect-android-package base.apk` (decoded manifest, 16 permissions, 91 components) |
| Q1 renderer, Q9 libs | `unzip -l` of the splits; `strings` on `lib/arm64-v8a/*.so` (JNI symbol names, versions); REA `inspect-android-class com.android.vulkan.VulkanApi`; REA `inspect-android-method ARBaseActivity.h/.a/.d/.R`; `assets/shaders/{glsl,spv}` listing |
| Q2 | REA `inspect-android-method` on the session-config lambda (`defpackage.m.invoke`), `ARBaseActivity.M/.J`, `DepthSensingActivity.V`, `FeatureAvailability.<clinit>` (`te3`); dexdump xref pass on Frame/Session APIs; dex strings (`nn_models/…`, `fastsam_on_demand`) |
| Q3 | dexdump field scan (enum `MeasurementType.kt` = `vq5`, `ToolsAdapter`, `ControlsStateSwitcher`); retained source-file names (`*AR_GL.java`); aapt2 strings and `drawable/ic_tool_*`, `bg_*` resources |
| Q4 | REA decompiles `ARulerActivity.D0/.P/.O`, `ARBaseActivity.d`; dexdump xref of string-resource IDs (`AdviceLayout`, `ARulerMainUIActivity`); `res/layout/dialog_settings.xml`, `plane_detection_advice_layout.xml` |
| Q5 | aapt2 strings and layouts (no ruler UI); dexdump xref of `DisplayMetrics.xdpi/ydpi`; REA decompile `AppSettings.b` (`ex.b`) |
| Q7 | manifest; class-package counts from REA `search-android-classes ""`; `*.properties` version files; REA decompiles `MeasurementType.isToolLocked`, `TryPremiumToolDialog.a`, `UnlockToProceedDialog.a`, `ARulerMainUIActivity.s1`, `PremiumWatcher` (`f97.a`); xref of `isToolLocked` callers |
| Q8 | REA decompiles of the PDF writer (`sq8.run`), share (`ia.run`, `oq8.onClick`); `res/layout/dialog_choose_format.xml`, `dialog_share_document.xml`; `res/xml/provider_paths.xml`; dex string scan for file names and extensions |
| Q10 / implications | Synthesis of the above |

Working files are kept outside the repo in the session scratchpad, under `rea-run/`: JSON evidence, dexdump output, xref JSON.

---

## Q1. AR stack and renderer

| Finding | Evidence | Status |
|---|---|---|
| ARCore is used, declared **optional** | `<meta-data com.google.ar.core = "optional">`; `com.google.ar.core.min_apk_version = 260760000`; `com.google.ar.core.InstallActivity`; `<queries><package com.google.ar.core/>` | Verified |
| No `android.hardware.camera.ar` feature. Camera is **not required** | only `uses-feature android.hardware.camera required=false`, plus `vulkan.compute` / `vulkan.level` both required=false | Verified |
| ARCore SDK about 1.54 | string "1.54" in `libarcore_sdk_c.so`; min_apk_version above | Inferred |
| Runtime gating: AR screen checks support in `onResume` and exits with a "device not supported" toast | `ARBaseActivity.onResume` calls `ArCoreApk.checkAvailability`. Session creation catches `UnavailableApkTooOld` / `ArcoreNotInstalled` / `DeviceNotCompatible` / `SdkTooOld`, each mapped to a message. Async checks run in `ArCoreFunctionalityResolver` (`cy`). Install prompt runs via `ArCoreApk.requestInstall` (Compose "ARCore Required" dialog) | Verified |
| **Renderer: custom Vulkan**, not Sceneform, SceneView, Filament, Unity or GLES | Java class `com.android.vulkan.VulkanApi` (natives: `initVulkanApi`, `createBackgroundRenderer`, `createPlaneRenderer`, `createSinglePlaneRenderer`, `createHeapRenderer`, `createTextureRenderer`, `setTextureInfo(Bitmap)`, `render`). Implemented in `libvkapi.so` (634,144 B), which carries `VK_ANDROID_external_memory_android_hardware_buffer`, `VK_KHR_sampler_ycbcr_conversion` and `AHardwareBuffer_*`. `ARBaseActivity.h(Surface,Surface)` initialises Vulkan on the view surface plus a second (recording) surface | Verified |
| Camera image reaches Vulkan with no copy: ARCore texture-update mode `EXPOSE_HARDWARE_BUFFER`, then `Frame.getHardwareBuffer()`, then `setBackgroundDrawInfo(HardwareBuffer,…)` | session config lambda; `ARBaseActivity.d` | Verified |
| **All measurement geometry (lines, labels, reticle, point cloud) is drawn with `android.graphics.Canvas` into an offscreen Bitmap.** That bitmap is uploaded each frame as one full-screen texture over the camera | `UI_GL_renderer` (`w0a`) holds a Bitmap and Canvas, uploaded via `VulkanApi.setTextureInfo`. `RulerType` (`dz7`, base of every tool) has `m(Canvas)` plus many `Paint` fields. `PointCloudRendererCanvas`, `LabelsDrawer`, `LinesDrawer`, `AimPainter` all draw on Canvas | Verified |
| Vulkan draws only: camera background, plane grids (all planes / selected plane), a "heap" (pile) colored mesh, a curved-tape strip, a zoom/magnifier pass, and the UI texture | shader assets `assets/shaders/glsl/*.{vert,frag}` (GLSL `#version 450` with Vulkan descriptor sets: `plane`, `single_plane`, `heap`, `curved_tape`, `zoom`, `screenquad_*`, `alpha_clear`) and the matching `assets/shaders/spv/*.spv` | Verified |
| No GL fallback found. On Vulkan errors the app logs to Crashlytics and tears down resources (`ARBaseActivity.R`). GL classes in the APK belong to libraries (CameraX `OpenGlRenderer`, ExoPlayer, OpenCV) | xref of `glDraw*` / `eglCreateContext` hits only SDK classes | Inferred |
| `RecordableGLSurfaceView` is misnamed: it is a SurfaceView that feeds a `MediaRecorder` surface for video capture | `RecordableGLSurfaceView.a/b` → `MediaRecorder.setVideoSource/setVideoSize` | Verified |
| No glTF/GLB, `.sfb`, `.filamat`, Unity or IL2CPP assets or libraries | `unzip -l` of base and arm64 | Verified |
| Code appears to grow out of Google's ARCore sample structure (`DisplayRotationHelper`, `BackgroundRenderer`, `PlaneRenderer` names; Apache header in a shader) | retained source-file names | Inferred |

## Q2. Depth, raw depth, instant placement, geospatial, ML

| Finding | Evidence | Status |
|---|---|---|
| **ARCore Depth API disabled** (`DepthMode.DISABLED`). Support for AUTOMATIC depth is only logged as an analytics param named "device_depth_api" | session config lambda; `ARBaseActivity.M(Session)` | Verified |
| No `acquireDepthImage` / `acquireRawDepthImage` calls; `DepthPoint` is not referenced by app code | dexdump xref (only the ARCore SDK enum `Session.java` / `ita` references `DepthPoint`) | Verified |
| **Hardware ToF depth instead:** on a hard-coded **device allowlist**, the app opens the rear camera that has `DEPTH_OUTPUT` capability through **Camera2 + ImageReader**, alongside ARCore (camera config: 30 fps, about 640×480, `DepthSensorUsage.DO_NOT_USE`). Allowlist: Samsung Note10+ (d2*), S20+ (y2*), S20 Ultra (z3*) and Japanese carrier variants, plus LG "timelm" | `FeatureAvailability` (`te3`) brand→device map; `ARBaseActivity.J`; `DepthSensingActivity.V`; `DepthCameraManager` (`pr2`/`qr2`); `DepthMapHelper` (`ur2`, consumes `short[]` = DEPTH16); `DepthFrame`, `DepthCameraInfo` | Verified (allowlist and path) / Inferred (that it powers box, volume and pile tools) |
| Instant placement, cloud anchors, augmented faces and light estimation are all **DISABLED**. Geospatial, Earth, Semantics and Streetscape are unused (SDK classes only, no app references) | session config; REA `trace-android-references` on `Config$*Mode` and `Earth` | Verified |
| Planes: `HORIZONTAL_AND_VERTICAL`; update mode `LATEST_CAMERA_IMAGE`; focus AUTO or FIXED depending on a settings flag; flashlight via `FlashMode.TORCH` | session config; `l0.invoke`; `dialog_settings.xml` has an "Autofocus" switch | Verified / Inferred (flag is that switch) |
| **TFLite** runtime + GPU delegate (NNAPI delegate class present). Interpreter is built from a **File**. | `libtensorflowlite_jni.so`, `libtensorflowlite_gpu_jni.so`; `FastSam.kt` (`le3`) builds the interpreter with a `File` argument | Verified |
| Model is **FastSAM-s** (`nn_models/fastsam_s.tflite`), shipped as a **Play Asset Delivery on-demand pack** `fastsam_on_demand` (not in the APK) | dex strings; `OnDemandAssetProvider`; `asset-delivery` 2.3.0 | Verified (names) / Inferred (delivery mechanics) |
| FastSAM purpose: segment the **reference object** (A4 sheet / card) as a quad in Photo-measure | `FastSamQuadDetector`, `QuadDetector`, `FastSamPostprocess`, `RefSceneQuad`, `ReferenceMask*` | Inferred |
| **OpenCV 4.12.0** for classical CV: rectangle (quad) auto-detect, and circle auto-detect via the **AAMED** ellipse detector in Grymala's `libcircle-detector-lib.so` | `libopencv_java4.so` banner; `CVCore_Quad`, `CVCore_Circle.runAAMED_JNI`; AAMED timing strings in the `.so` | Verified |
| **Point Cloud Library** (`libpcl-lib.so`: KdTree/FLANN, StatisticalOutlierRemoval) behind `PCLGrymalaLib.pclPlaneDetection` / `pclStatFiltering`. Used by box ("prism") auto-detect: aim, filter, plane finding, whole-cloud pass, plane gathering, DBSCAN segmentation, rectangle finding | JNI names; `PCCorePrism` stage enum (`np6$a`); `DepthAlgsPars` (`lr2$b`: plane distance threshold, DBSCAN radius, …) | Verified |
| Auto-detect feeds the **camera Y-plane image** (`Frame.acquireCameraImage`) plus the selected plane's pose into CV | `ARulerActivity.P` | Verified |
| No ML Kit; no ONNX / ncnn / MNN. `libnms.so` is **not** non-max-suppression: it's ByteDance/Pangle security (`com.pgl.ssdk`) | `strings libnms.so` | Verified |

## Q3. Measuring modes

The main tool enum `MeasurementType.kt` (`vq5`) has 23 values. Each tool has a renderer class in `*AR_GL.java` and a `drawable/ic_tool_*` icon.

| Listing claim | Internal tool(s) | Evidence | Status |
|---|---|---|---|
| Ruler / distance | `EDGE` (UI label "Line & Height", `EdgeAR_GL`, supports extrude for height) and `DOT` (`DistancePointAR_GL`, "Distance" icon, label prefix "D=") | enum; `string/line`, `string/distance_tool`, `ic_tool_line`, `ic_tool_distance` | Verified (enum and classes) / Inferred (label-to-enum mapping; DOT = point-to-camera distance) |
| Height | `HEIGHT` + `HeightAR.java`; the EDGE tool's `EXTRUDE` state ("Height=" / "H=" prefixes) | enum; `ARulerActivity$d.EXTRUDE`; `EdgeAR_GL` uses the height prefix | Verified |
| Angle | `ANGLE` (`AngleAR_GL`) | enum, `ic_tool_angle` | Verified |
| Area & perimeter | `POLYGON` (`PolygonAR_GL`), `RECTANGLE` / "Square" (`SquareAR_GL`), `CIRCLE` (`CircleAR_GL`, "R=" radius); labels "S=", "P=" | enum, strings, icons | Verified |
| Volume | `CUBE` (`CubeAR_GL`), `CYLINDER` (`CylinderAR_GL`), `VOLUME` / "Volume smooth" (`VolumeAR_GL`, side area "Ss=", "V="), `HEAP` = "Pile" (`HeapAR_GL` + Vulkan heap mesh, scan from floor) | enum, strings, `bg_*` art | Verified |
| Path | `POLYLINE` (+ "smooth" variant) and `POLYLINE_3D` ("measure on curved surfaces", `CurvedTapeAR_GL`, `AimFitPlane` local plane fitting) | enum, strings | Verified |
| Room plan | `PLAN` (`PlanAR_GL`) → 2D `PlanView`/`PlanData`/`PlanRenderer`, exported as PDF/JPG. Also `WALL` / `AUTOWALL` ("Curved wall"). There is a cross-promo for the separate "AR Plan 3D" app (`com.grymala.arplan` query) | enum; plan classes; promo strings | Verified |
| On-screen ruler | **Not present in 3.3.6** (see Q5) | — | Verified (absence, static) |
| Photo measure | **Photoruler** (`PhotorulerActivity`): photo + reference object (A4, payment card, custom rectangle with long/short side), tools Length and Height, FastSAM quad segmentation, "Edit scale" | activity, Compose screens, strings | Verified |
| Others not on the listing | **Auto-detect** box/rectangle/circle (`AUTODETECT_PRISM/QUAD/CIRCLE`); auto variants `AUTOPOLYGON`, `AUTOPOLYLINE`, `AUTOVOLUME`, `AUTOWALL`; **Manual plan** ("add measurements on the photo manually": line/angle/area on a photo); **video recording** of the AR session with a timer; photo capture; project **archive** with folders/search/sort | enum, strings, activities | Verified |

## Q4. Calibration and accuracy handling

| Finding | Evidence | Status |
|---|---|---|
| **No AR calibration screen** exists. Accuracy is handled through UX, not calibration | no strings, layouts or classes for AR calibration | Verified (absence) |
| Tracking: only `Camera.getTrackingState()`. On PAUSED, drawing stops and planes are hidden. **`TrackingFailureReason` is never read**, so there are no specific "too dark / moving too fast" messages | `ARBaseActivity.d/.a`; trace shows no app refs to `TrackingFailureReason` | Verified |
| Measuring is enabled only after at least one plane of type up/down/vertical is TRACKING. A "planes detection…" state plus an animated search hint (`raw/ar_search.json` Lottie) show until then | `ARBaseActivity.d`; strings; `ControlsStateSwitcher` states `PLANES_SEARCH / PLANE_AIMED / PLANE_NOT_AIMED / DRAWING / ZOOM / AUTODETECT / VIDEO` | Verified |
| **Aim with a centre reticle** (crosshair). Points are placed at the aim point, not at the finger | `AimDrawer`, `AimPainter`, `AimStatesManager`; `dz7.X` = screen centre | Verified |
| Aim position is **low-pass filtered** (lerp factor about 0.35 per frame) and hit poses are `interpolate`d for stability | `ARulerActivity.P` / `.D0` | Verified |
| **Plane lock + infinite-plane raycast:** before a plane is selected, ARCore `hitTest` is used, accepted only if `Plane.isPoseInPolygon`. Once selected (haptic tick on lock), the app ray-casts from the reticle onto the **infinite plane** through the selected plane's centre pose. Measuring can then extend beyond the detected polygon (`INFINITY_PLANE_HIT` state) | `ARulerActivity.D0`; `CustomPlaneTestHit` / `CustomHitResult`, which are app classes placed in the `com.google.ar.core` package; `VibrationUtils` call on selection | Verified |
| Subsumed planes are de-duplicated (`getSubsumedBy`); "Reset plane" and "Select plane" actions; plane overlay can be toggled ("Show planes" setting); the selected plane fades in and out | `PlaneUtils`, `SortablePlane`, `PlaneSelectionUI`, `PlaneRenderer` (alpha step 0.025) | Verified |
| **Snapping:** a "Sticking" setting switch plus `StickingMaster` | `dialog_settings.xml` `switch_sticking`; `StickingMaster.java` | Verified (exists) / Unverified (snap radius and rules) |
| **Magnifier / zoom:** Vulkan `zoom` shader pass plus a `ZOOM` controls state. Photo-mode magnifier (`MagnifiedRegionImage`, `SelectionMagnifier`) | shaders, enums, classes | Verified |
| Feature-point cloud is drawn as dots during scanning | `PointCloudRendererCanvas` (`y47`) fed by `acquirePointCloud()` | Verified |
| **Advice carousel** when planes aren't found (paraphrased): aim at a textured surface; keep a suitable distance; ensure good light; move closer/farther; change the viewing angle; try another surface. Plus a "move closer or point elsewhere" hint | `AdviceLayout` static init references `advice_1…6`; `plane_detection_advice_layout.xml` | Verified |
| Onboarding warns it won't work on non-textured surfaces or in poor light (short instructional videos `rta_*.mp4`, `planes_advanced.mp4`) | strings `instruction_advice_*`; `res/raw` | Verified |
| Projection near/far = 0.1 m / 100 m; no explicit max-distance warning found | `getProjectionMatrix(…, 0.1f, 100f)` | Verified (clip) / Unverified (any distance cap) |
| Guard rails: "finish the current element first", "need at least one surface", "no elements on a horizontal surface" (plan), "no elements to capture" | xref of string IDs to `ARulerMainUIActivity.f1/.q1`, `p0.onClick` | Verified |
| Photo mode accuracy: a **reference mismatch** dialog explains how to fix mis-detected corners and swapped long/short sides | strings `reference_mismatch_*`; Compose dialog | Verified |
| Session analytics: AR session stats are stored, plus a scene-reconstruction failure bottom sheet | `DefaultArSessionStatisticsRepository`, `SceneReconstructionFailureBottomSheet` | Verified (classes) / Unverified (triggers) |

## Q5. On-screen ruler

| Finding | Evidence | Status |
|---|---|---|
| **No on-screen ruler in v3.3.6.** No strings, layouts, activities or Compose files for it. The Play listing claim may be stale or iOS-only | aapt2 string table (544 entries), layout list, source-file names | Verified (static absence) |
| `DisplayMetrics.xdpi/ydpi` is read only for a **UI scale factor** (average dpi ÷ 400) in `AppSettings.b`, and once in `PhotorulerEditorScreen` (`cz6.e`) | dexdump xref; REA decompile `ex.b` | Verified / Inferred (`cz6` use) |
| Their **non-AR path is photo measurement with a reference object** (A4 sheet / payment card / custom rectangle), plus "Manual plan". There is a non-AR onboarding variant (`OnboardingNonArV1`, `onboarding_non_ar_*` art) and main-menu config entries `AR_RULER / PHOTORULER / MANUAL_PLAN / AR_PLAN` | `MainMenuConfigRepository` enum `hj5`; `MainMenuButtonConfigRepository` checks ARCore availability | Verified (components) / Inferred (exact routing on non-AR devices) |

## Q6. Permissions and sensors

Permissions, all **Verified** from the manifest:
- Product: `CAMERA`, `VIBRATE`, `INTERNET`, `ACCESS_NETWORK_STATE`, `HIGH_SAMPLING_RATE_SENSORS`.
- Billing: `com.android.vending.BILLING`.
- Ads and attribution: `AD_ID`, `ACCESS_ADSERVICES_{TOPICS,ATTRIBUTION,AD_ID,CUSTOM_AUDIENCE}`, install-referrer bind.
- WorkManager and Play asset delivery: `WAKE_LOCK`, `FOREGROUND_SERVICE` (+`_DATA_SYNC`).
- Internal: a signature-level dynamic-receiver permission.

| Finding | Evidence | Status |
|---|---|---|
| No storage, location, microphone or notification-manifest permissions. Video is recorded without audio; MediaRecorder video source only | manifest; `RecordableGLSurfaceView` | Verified (manifest) / Inferred (no audio) |
| uses-feature: `android.hardware.camera` (required=false), `vulkan.compute` / `vulkan.level` (required=false). Optional native libs `libOpenCL*.so` (for the TFLite GPU delegate) | manifest | Verified |
| **App code registers no sensor listeners.** Every `SensorManager.registerListener` / `getDefaultSensor` call sits in Play Services Ads, Crashlytics or the Facebook SDK. Motion comes from ARCore, which reads sensors in its own process | dexdump xref | Verified |
| `HIGH_SAMPLING_RATE_SENSORS` origin not determined (probably a merged SDK manifest, not app code) | — | Unverified |
| `extractNativeLibs=false`, `largeHeap=true`, portrait-only activities, `max_aspect 2.1` | manifest | Verified |

## Q7. Ads, billing, analytics, crash SDKs, and the paid tier

| Category | SDKs (version where known) | Status |
|---|---|---|
| Ads | **AdMob** (play-services-ads 25.4.0, app id in manifest; ad units for banner, two interstitials, native, two rewarded) with mediation adapters **Meta Audience Network**, **ironSource/LevelPlay** (+ ad-quality SDK), **Pangle/ByteDance** 8.1.0.5, **Unity Ads**. OM SDK assets. Google **UMP** 4.0.0 consent (`ConsentActivity` is the launcher) | Verified |
| Billing | **Play Billing 8.3.0**; **RevenueCat** (`com.revenuecat.purchases`, Amazon module present); `BillingManager` → `PremiumWatcher` | Verified |
| Analytics / attribution | Firebase Analytics 23.2.0, Remote Config + A/B Testing, Performance, Sessions, Installations; Facebook SDK (app events, share); **Tenjin** attribution (`TENJIN_APP_STORE` meta, customer user id set) | Verified |
| Crash | Firebase **Crashlytics + NDK**; ByteDance APM Insight (inside Pangle) | Verified |
| Other | Play In-App Review 2.0.2; Play Asset Delivery 2.3.0; Lottie; CameraX; Media3 ExoPlayer; JTS (geometry, polygon ops); poly2tri (triangulation); Hilt; Compose + Views mix | Verified |
| Not present | AppLovin, AppsFlyer, Adapty SDKs. AppsFlyer / Adapty names appear only in RevenueCat helpers and backup-rules leftovers | Verified |

**Paid tier ("ARuler Premium"):**

| Finding | Evidence | Status |
|---|---|---|
| Premium flag `AppSettings.a` short-circuits all locks | `isToolLocked`, `s1`, `UnlockToProceedDialog` all test `ex.a` | Verified |
| **Free tools: only `DOT` and `ANGLE`, or `EDGE`+`ANGLE`+`DOT`, chosen by a remote A/B flag.** Every other tool is locked | `MeasurementType.isToolLocked()`; `InstantToolsAdsConfig` A/B enum (`mm4` A/B) | Verified (logic) / Unverified (which arm ships to whom) |
| Locked tools can still be used in a **"try" mode where values are hidden**, or **unlocked for one use by watching a rewarded video** | `TryPremiumToolDialog.a` text switching; `SingleUseToolUnlockHolder`; `GrymalaRewardedAd` | Verified |
| Saving a **photo / video / plan** while locked tools are on the scene requires premium | `UnlockToProceedDialog.a` (photo / video / plan / measurements titles) | Verified |
| Premium also removes ads and unlocks the archive. The feature list on the paywall: more tools, more discounts, one free project, detailed manual, UI improvements | strings `premium_tools_*`, `feature_*` | Verified (strings) / Unverified (enforcement of each) |
| Share is shown with a lock icon for free users | `ic_share_locked` / `ic_share_unlocked` in the share dialog | Inferred |
| Subscription periods: week / month / 3 months / year, free-trial template (3 days default), "Save N%" special offers, two-subscription paywall, popup and start special offers, congratulation dialog | strings; `TwoSubscriptionsPaywallV1`, `SpecialOfferActivity` family | Verified |
| Remote-configured paywall, ads and menu (`PaywallConfig`, `AdsConfig`, `MainMenuUiConfig`, `ABTestConfig`, `OnboardingVariantConfig`) | class names | Verified (existence) / Unverified (keys and values) |

## Q8. Export

| Finding | Evidence | Status |
|---|---|---|
| **PDF via platform `android.graphics.pdf.PdfDocument`** (no third-party PDF lib). The plan is **rasterised to a Bitmap** and drawn into a page sized to that bitmap. Tall plans (> 2828 px) split into 2 pages | REA decompile `sq8.run(String, Bitmap, PlanData)` | Verified |
| Save-as dialog offers **PDF** or **JPG** | `dialog_choose_format.xml` (`iv_pdf`, `iv_jpg`, "Save as") | Verified |
| Photo capture = `PixelCopy` of the AR SurfaceView (RGB_565), then post-processing | `ARulerActivity.O` | Verified |
| **Video** (MP4) via `MediaRecorder` surface fed by the Vulkan swapchain's second surface; user video timer | `RecordableGLSurfaceView`, `VideoTimerView`, settings "Video timer" | Verified |
| Share = `ACTION_SEND`, MIME `*/*` (PDF) or `video/mp4`, via **FileProvider** authority `com.grymala.aruler.provider` (paths: files, cache, external, external-files, external-cache) | `ia.run`, `oq8.onClick`, `provider_paths.xml` | Verified |
| Project archive is a folder per project holding name, creation date, saved geometry (`saveddata.txt`), `metadata.json`, `img.jpg`, thumbnail, `video.mp4`; folders, search, sort | dex string scan; `ArchiveDataManager`, `SavedData` / `ImageSavedData` / `PlanSavedData` / `VideoSavedData` | Verified (names) / Inferred (layout) |
| Units: mm, cm, m, in, ft, yd (+ feet-inch imperial type); unit picker at first run | `MeasurementUnit` enum (`wq5`), `ImperialMeasurement`, `SelectUnitsActivity` | Verified |
| **No CSV, DXF, SVG, OBJ or glTF export** | dex string scan for extensions / MIME types | Verified (static absence) |

## Q9. Native libraries (`split_config.arm64_v8a.apk`, `lib/arm64-v8a/`)

Total of about 20.75 MB uncompressed.

| Library | Bytes | Owner / purpose | Status |
|---|---:|---|---|
| `libopencv_java4.so` | 8,942,768 | OpenCV 4.12.0 (quad / circle CV) | Verified |
| `libtensorflowlite_jni.so` | 4,475,248 | TFLite runtime (FastSAM) | Verified |
| `libtensorflowlite_gpu_jni.so` | 2,585,168 | TFLite GPU delegate | Verified |
| `libpcl-lib.so` | 888,840 | Grymala wrapper over PCL + FLANN (point-cloud plane detection, outlier filtering) | Verified |
| `libcrashlytics-common.so` | 864,616 | Firebase Crashlytics NDK | Verified |
| `libvkapi.so` | 634,144 | **Grymala custom Vulkan renderer** (`com.android.vulkan.VulkanApi`) | Verified |
| `libunitycoherencenative.so` | 493,112 | Unity Ads (coherence bridge) | Verified |
| `libtt_ugen_layout.so` | 440,672 | Pangle / ByteDance ad layout engine | Verified |
| `libnms.so` | 302,248 | Pangle security SDK (`com.pgl.ssdk`), **not** ML NMS | Verified |
| `libcrashlytics.so` | 231,960 | Crashlytics NDK | Verified |
| `libcrashlytics-handler.so` | 222,056 | Crashlytics NDK | Verified |
| `libcircle-detector-lib.so` | 132,136 | Grymala AAMED ellipse / circle detector (`com.grymala.aruler.cv`) | Verified |
| `libapminsightb.so` | 124,352 | ByteDance APM Insight | Verified |
| `libapminsighta.so` | 102,256 | ByteDance APM Insight (native crash) | Verified |
| `libarcore_sdk_jni.so` | 100,816 | ARCore SDK JNI shim | Verified |
| `libpglarmor.so` | 68,776 | Pangle anti-tamper | Verified |
| `libarcore_sdk_c.so` | 68,080 | ARCore SDK C shim (ARCore itself runs in Play Services for AR) | Verified |
| `libimage_processing_util_jni.so` | 32,528 | CameraX | Verified |
| `libandroidx.graphics.path.so` | 10,096 | AndroidX graphics-path | Verified |
| `libbuffer_pgl.so` | 9,000 | Pangle (`com.bykv.vk`) | Verified |
| `libdatastore_shared_counter.so` | 7,112 | AndroidX DataStore | Verified |
| `libfile_lock_pgl.so` | 6,312 | Pangle | Verified |
| `libsurface_util_jni.so` | 4,896 | CameraX | Verified |
| `libcrashlytics-trampoline.so` | 4,744 | Crashlytics NDK | Verified |

**Size picture:**
- Ad SDKs add about 1.5 MB of native code, plus `assets/audience_network/classes2.dex` (5.2 MB) and roughly 3k Meta, 2.2k ironSource and 1.7k ByteDance classes.
- The custom AR renderer is only about 0.63 MB.
- CV/ML (OpenCV + TFLite + PCL) is about 17 MB, and the FastSAM model downloads on demand.

## Q10. What this means for our renderer and ARCore-optional choices

- **The market leader for this category ships no 3D engine.** Its AR view is:
  - camera background,
  - plane grids,
  - one 2D overlay bitmap drawn with `Canvas`, holding every line, label, reticle and tool.
  
  Even 3D-looking tools (cube, cylinder, volume, angle arcs) are 3D points projected to the screen and drawn in 2D. The only true meshes are the planes, the pile surface and the curved-tape strip. (Verified)
- They chose Vulkan, probably for the zero-copy `HardwareBuffer` camera path and frame pacing. That is a large engineering investment. Nothing in the APK suggests it is *needed* for measuring accuracy. (Inferred)
- ARCore **optional** plus runtime availability checks plus an install prompt is exactly what they ship, so our ARCore-optional design is validated. Their fallback for non-AR devices is **photo-based measurement with a reference object**, not an on-screen ruler. (Verified / Inferred)
- They do **not** use ARCore Depth. Only a ToF Camera2 path on about 15 legacy Samsung/LG device codes. Depth is not a prerequisite for a competitive tape measure. (Verified)

---

## Implications for Measure Sama

1. **Renderer: drop SceneView/Filament for the MVP.** Use ARCore + a minimal OpenGL ES camera-background renderer (the pattern from Google's ARCore samples) + a 2D overlay (Android `View`/Compose `Canvas`) that projects anchor poses through the view-projection matrix every frame. Reasons:
   - It matches how the category leader draws everything.
   - It gives pixel-crisp labels and lines at any distance.
   - Far smaller APK. Filament plus gltfio is several MB; the exact number is unverified for our build.
   - Fewer lifecycle and version-churn issues inside a Capacitor plugin.
   
   Re-evaluate SceneView only if we later want occluded 3D objects or glTF content. Vulkan is not worth it.
2. **ARCore optional: keep it.**
   - Mirror their pattern: `com.google.ar.core=optional`, camera `required=false`, `checkAvailabilityAsync` before showing AR entry points, a friendly install/update prompt, and mapping every `Unavailable*Exception` to a clear message.
   - Our on-screen ruler fallback is a **differentiator**; they don't have one. `xdpi` is unreliable on many devices, so ship a **one-time calibration** against a standard bank card (ID-1, 85.60 × 53.98 mm; they already use "payment card" and A4 as reference objects).
3. **Depth API:** leave it off for v1 (they do too). Later, try `DepthMode.AUTOMATIC` hit-tests as a fallback when no plane is under the reticle. Gate it on `isDepthModeSupported` and log support, as they do.
4. **Modes, in order:**
   1. Two-point distance on a plane (their free tool is line/height).
   2. Height (vertical extrude from a floor point).
   3. Angle (free in theirs).
   4. Polyline / path + polygon area & perimeter.
   5. Rectangle and circle.
   6. Box volume.
   
   Skip pile/heap, ToF, auto-detect, FastSAM and room plan until there's traction.
5. **Accuracy UX to adopt.** All of these were seen in theirs:
   - Centre reticle aiming, not finger-tap placement.
   - Low-pass filtered aim point.
   - Plane-lock with haptic feedback, then raycast onto the **infinite** locked plane so lines can run past the detected polygon.
   - Accept pre-lock hits only inside the plane polygon.
   - Ignore subsumed planes.
   - Settings toggles: snapping ("sticking"), plane overlay, autofocus, torch.
   - An advice carousel while no plane is found.
   - Stop drawing while tracking is paused.
   
   **Do better than them:** surface `TrackingFailureReason` (light / motion / features), show a live "quality" indicator, and warn beyond about 5 m.
6. **Monetization patterns seen.** Their model is heavy:
   - Nearly all tools locked.
   - "Try" mode with hidden values.
   - Rewarded-video single-use unlocks.
   - Paywall with trial and special offers.
   - Mediated ads from four networks.
   - Locked capture/share of results.
   
   It costs them well over 6 MB of dex/native code and a consent flow. Since Measure Sama's pitch is "free", consider a small optional pro unlock, or tasteful single-network ads, and keep core measuring and sharing free.
7. **Export approach:**
   - Native side: `PixelCopy` the AR view (camera + overlay) to a bitmap and write JPEG/PNG to app cache.
   - For a plan or summary PDF, use `android.graphics.pdf.PdfDocument` natively (as they do), or jsPDF in the web layer.
   - Share via `FileProvider` + `ACTION_SEND`, or the Capacitor Share plugin with the returned file URI.
   - Store measurements as JSON (points + units), not just images, so CSV/DXF can be added later. Neither is offered by them, which is a cheap differentiator.

## Open questions / needs runtime check

- [ ] Which free-tool A/B arm users see (`DOT+ANGLE` vs `EDGE+ANGLE+DOT`), and what exactly `DOT` measures (point-to-camera distance?).
- [ ] Whether an on-screen ruler exists in other versions or on iOS; the Play listing claim isn't backed by 3.3.6.
- [ ] Snap ("sticking") radius and targets; any maximum-distance limits or warnings.
- [ ] Behaviour on devices without Vulkan 1.1 or with Vulkan init failures (is there any fallback, or does AR just fail?).
- [ ] Which tools actually use the ToF path vs the ARCore point cloud, and whether the ToF allowlist still matters on current devices.
- [ ] FastSAM on-demand pack size and when it downloads; photo-measure accuracy with a card vs A4.
- [ ] Remote Config keys and defaults (paywall, ads frequency, menu layout, onboarding variant).
- [ ] Whether share/export is blocked for free users (lock icon seen) and whether exports carry a watermark (no app watermark code found; the only "watermark" hit belongs to an ad SDK).
- [ ] Exact ARCore SDK version (1.54 inferred) and the origin of `HIGH_SAMPLING_RATE_SENSORS`.
- [ ] Real-world accuracy vs ours: needs a side-by-side test on the same phone and surfaces.
