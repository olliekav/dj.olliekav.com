# Readme

[![Netlify Status](https://api.netlify.com/api/v1/badges/221a1872-d36b-48af-9ceb-f4a73d37d3da/deploy-status)](https://app.netlify.com/sites/djolliekav/deploys)

This is a showcase site for my [OK Sessions DJ mixes](https://soundcloud.com/olliekav/sets/ok-sessions). SoundCloud is the source of truth: the mixes, their order, waveforms and audio all come from the OK Sessions playlist. This repo adds each mix's colour theme and a small API that the website and native apps share.

## Repo layout

| Path | What |
|---|---|
| `src/` | Website (Preact + Vite + Wavesurfer) |
| `netlify/` | API functions: `/api/mixes`, `/api/stream`, `/api/devices`, and the hourly new-mix notifications |
| `shared/mix-themes.json` | Colour theme per session |
| `shared/api-types.ts`, `shared/fixtures/` | API response types and fixtures shared by every test suite |
| `scripts/mix-tools/` | Colour, artwork and SoundCloud tools |

## Website

```bash
npm install
npm run dev     # https://localhost:5173, with the API functions running locally
npm test
npm run typecheck && npm run lint
```

The functions need `SOUNDCLOUD_CLIENT_ID` and `SOUNDCLOUD_CLIENT_SECRET`: set them in Netlify, and in a root `.env` for local development.

## API

| Path | Returns |
|---|---|
| `GET /api/mixes` | The playlist as `{ mixes: Mix[] }`, numbered by position, with each mix's theme, SoundCloud waveform and artwork URLs. Cached on Netlify's CDN for 5 minutes |
| `GET /api/stream?urn=soundcloud:tracks:<id>` | `{ url, format }`: a short-lived signed HLS URL (AAC 160k). Only for tracks in the playlist; never cached; rate limited per IP |
| `POST /api/devices` | Registers an APNs device token for new-mix notifications: `{ token, platform: "ios" }`, the token as hex. 204; rate limited per IP |
| `DELETE /api/devices` | Unregisters it: `{ token }`. 204 |

Only the functions talk to SoundCloud, so the app credentials never reach clients. The app token is shared between function instances through Netlify Blobs, since SoundCloud caps token requests at 50 per 12 hours. Each `/api/stream` call counts towards SoundCloud's limit of 15,000 stream requests per day, which is why streams are resolved only when playback starts.

### New-mix notifications

An hourly scheduled function (`new-mix-notifications`) fetches the playlist and compares its newest mix with the last one announced, kept in the `push` Blobs store. Each new mix goes to every registered device as "OK Sessions #N is out", with `{ mix: N }` in the payload for the app to play it, and `/api/mixes` is purged from the CDN so the app finds it. The first run only records the newest mix. Tokens Apple reports invalid are deleted.

Pushes go straight to APNs over HTTP/2 with token-based auth, so there's no third-party push service. It needs these Netlify environment variables:

| Variable | Value |
|---|---|
| `APNS_KEY_ID` | The APNs key's ID |
| `APNS_TEAM_ID` | `3B26SQGP8Q` |
| `APNS_KEY` | The `.p8` key file's contents |
| `APNS_BUNDLE_ID` | `com.olliekav.oksessions` (the default) |
| `APNS_HOST` | `api.push.apple.com` for TestFlight and App Store builds (the default), `api.sandbox.push.apple.com` for builds run from Xcode |

Tokens from one environment are rejected by the other's host (and deleted), so point a deploy preview at the sandbox to test with Xcode builds.

SoundCloud's API terms apply to the apps: credit SoundCloud and link to each track, no offline listening or downloads, and no ads or paid unlocks around the mixes.

## Colours and artwork

Each mix has a two-colour theme in `shared/mix-themes.json`, used by the website, the apps and the artwork: the OK logo and `#<number>` in the foreground colour on the background. Rendering artwork needs FF DIN Round Pro Black (licensed, not committed). Copy `scripts/mix-tools/.env.example` to `scripts/mix-tools/.env` and fill it in, then `cd scripts/mix-tools && npm install`.

```bash
npm run themes -- --generate 132        # colours for a new mix: unique, readable, deterministic
npm run themes -- --reroll 27           # pick again
npm run artwork -- --only 132           # 2000×2000 JPGs on your Desktop for SoundCloud
npm run artwork -- --sheet              # contact sheet of every mix
```

Generated themes stay within the contrast range of the hand-picked ones, always include a light colour, avoid plain black or white logos and two shades of one colour, and are checked against every other mix so no two look alike.

### Updating SoundCloud

```bash
npm run soundcloud-artwork -- --dry-run                # check the playlist numbering
npm run soundcloud-artwork                             # replace all artwork (2000×2000) via the API
npm run soundcloud-artwork -- --only 21-50 --mp3s      # re-tagged originals for "Replace file"
```

Replacing artwork signs in as you in the browser (needs SoundCloud Pro, and `http://localhost:8976/callback` as the app's redirect URI). It refuses to run if a track's title number doesn't match its playlist position. SoundCloud's API can't replace audio, so `--mp3s` downloads each original (downloads must be enabled) and saves it with the new cover and O:K tags embedded, the audio copied untouched, to `~/Desktop/ok-sessions-mp3`, ready for **Replace file** in the track editor, which keeps plays and comments.
