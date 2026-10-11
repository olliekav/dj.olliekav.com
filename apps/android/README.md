# O:K Sessions for Android

Kotlin + Jetpack Compose + Media3, mirroring the iOS app in `apps/ios`.

| Module | What |
|---|---|
| `core` | Plain Kotlin (JVM): models, `/api` client, search, tracklist parsing, colours. Unit tested against `shared/fixtures` |
| `app` | Compose UI, and `PlaybackService` (Media3 `MediaLibraryService`): background playback, media notification, lock screen and Bluetooth controls, Android Auto |

Streams are resolved from `/api/stream` only when the player loads a mix (`StreamResolver`), as on iOS and the web.

```bash
./gradlew :core:test            # unit tests
./gradlew :app:assembleDebug    # app/build/outputs/apk/debug/app-debug.apk
./gradlew :app:installDebug     # onto a running emulator or device
```

Needs JDK 17+ and the Android SDK with platform 37 (`ANDROID_HOME`, or `sdk.dir` in `local.properties`).
