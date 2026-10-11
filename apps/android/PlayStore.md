# Google Play listing

Copy and answers for Play Console. Assets are made from the app: see "Graphics" below.

## Store listing

| Field | Value |
|---|---|
| App name (30) | O:K Sessions |
| Short description (80) | UK bass DJ mixes by O:K: techno, drum & bass, breaks, dubstep and garage (72) |
| Category | Music & Audio |
| Tags | Music, DJ mixes |
| Email | (your support address; required, shown publicly) |
| Website | https://dj.olliekav.com |
| Privacy policy | https://dj.olliekav.com/privacy |

## Full description (4000)

OK Sessions explores the world of UK bass music: leftfield techno, drum & bass, breakbeats, dubstep and UK garage, mixed by O:K.

Every session is here, from #1 to the latest, each with its own artwork and colours.

• Tap any mix to start playing
• Waveform scrubbing, plus 15-second skips to find your place
• Plays in the background, with notification, lock screen and Bluetooth controls
• Play on speakers and other devices
• Android Auto for listening on the road
• Shuffle the whole collection
• Search by session number, title or genre

Mixes stream from SoundCloud, where you can also follow, like and comment on each one.

No accounts, no ads, no tracking.

## Graphics

| Asset | Size | File |
|---|---|---|
| App icon | 512 × 512 PNG | `icon-512.png` |
| Feature graphic | 1024 × 500 | `feature-graphic.png` |
| Phone screenshots | 1080 × 1920 (9:16), 2–8 | `phone/1-grid.png` … `phone/4-about.png` |

Play rejects screenshots whose long side is more than twice the short side, so take them with the emulator at 1080 × 1920 (`adb shell wm size 1080x1920`).

## App content (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | https://dj.olliekav.com/privacy |
| Ads | No ads |
| App access | All functionality available without special access |
| Content rating | Questionnaire: Music/Audio/Entertainment category, "No" to everything → Everyone / PEGI 3 |
| Target audience | 13+ (not designed for children) |
| Data safety | No data collected or shared. Data is encrypted in transit (HTTPS). No account creation. (Revisit when Android notifications are added: device or other IDs, App functionality, not shared.) |
| Government app / financial / health | No |
| News app | No |

### Foreground service (Media playback)

> O:K Sessions streams long DJ mixes (often over an hour). The media playback foreground service keeps a mix playing when the screen is off or the user switches apps, and shows the standard media notification with play/pause, skip and seek controls. It runs only while a mix is playing or paused in the queue, and stops when playback is dismissed.

Attach a short screen recording: start a mix, lock the phone, show the notification controls.

## Testing (personal account)

New personal accounts must run a **closed test with at least 12 testers opted in for 14 consecutive days** before applying for production access.

1. Internal testing: upload `app-release.aab`, add yourself, install from the Play Store link.
2. Closed testing: create a track, add 12+ testers (a Google Group or email list), share the opt-in link. Keep them opted in for 14 days.
3. Apply for production access (Dashboard), answering Google's questions about the test.
4. Production: promote the closed-test build and submit.

## Building

```bash
cd apps/android
./gradlew :app:bundleRelease   # app/build/outputs/bundle/release/app-release.aab
```

Signed with the upload key from `keystore.properties` (see `keystore.properties.example`). Play App Signing re-signs it for users. Bump `versionCode` in `app/build.gradle.kts` for every upload.
