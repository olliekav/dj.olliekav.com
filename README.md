# Readme

[![Netlify Status](https://api.netlify.com/api/v1/badges/221a1872-d36b-48af-9ceb-f4a73d37d3da/deploy-status)](https://app.netlify.com/sites/djolliekav/deploys)

This is a showcase site for my OK Sessions DJ mixes. Mixes are self-hosted: audio lives in Cloudflare R2 and the catalogue and play stats are served by a Cloudflare Worker. The website and the native apps all read from that API. Mixes can still be published to [SoundCloud](https://soundcloud.com/olliekav/sets/ok-sessions) separately; each mix links there.

## Repo layout

| Path | What |
|---|---|
| `src/` | Website (Preact + Vite, hosted on Netlify) |
| `apps/api/` | API Worker (Hono + D1) at `api.olliekav.com` |
| `scripts/publish-mix/` | CLI that encodes a master, uploads to R2 and registers the mix |
| `shared/mix-themes.json` | Colour theme per session, used when publishing |
| `shared/fixtures/` | API response fixtures shared by every test suite |

## Tech stack
- [Preact](https://preactjs.com/) + [Wavesurfer](https://wavesurfer-js.org/) for the site
- [Cloudflare Workers](https://developers.cloudflare.com/workers/), [D1](https://developers.cloudflare.com/d1/) and [R2](https://developers.cloudflare.com/r2/) for the API and media
- [Netlify](https://www.netlify.com/) for hosting the site

## Website

```bash
npm install
npm run dev     # https://localhost:5173, uses https://api.olliekav.com
npm test
```

Set `VITE_API_URL=http://localhost:8787` to use a local API.

## API (`apps/api`)

```bash
cd apps/api
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev     # http://localhost:8787
npm test        # Vitest inside the Workers runtime, with coverage thresholds via `npm run coverage`
```

Endpoints:

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/mixes` | Published mixes, newest first. Edge cached (5 min), ETag |
| GET | `/v1/mixes/:slug` | One published mix |
| POST | `/v1/mixes/:slug/plays` | `{ device_id, platform, completed? }`; one per device per mix per 30 min |
| POST | `/v1/mixes/:slug/downloads` | `{ device_id, platform }`; one per device per mix per day |
| GET | `/v1/admin/mixes` | Includes drafts. Bearer `ADMIN_TOKEN` |
| PUT | `/v1/admin/mixes/:slug` | Create or update a mix |
| GET | `/v1/admin/stats?from=&to=` | Plays, completions and downloads per mix and platform |

Event endpoints are rate limited per IP and device, and only accept browser requests from `ALLOWED_ORIGINS`.

### First deploy

```bash
cd apps/api
npx wrangler login
npx wrangler d1 create ok-sessions      # copy the database_id into wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put ADMIN_TOKEN      # e.g. `openssl rand -hex 32`
npm run deploy
```

Then in the Cloudflare dashboard:
- R2: create the `ok-sessions-media` bucket, connect the custom domain `media.olliekav.com`, and add a CORS rule allowing `GET`/`HEAD` from `https://dj.olliekav.com` (the site fetches peaks and audio cross-origin).
- Security: turn on Bot Fight Mode and Hotlink Protection for `media.olliekav.com`.
- Zero Trust > Access: protect `api.olliekav.com/v1/admin/*`, with a service token for the publish CLI.

## Publishing a mix

Requires `ffmpeg`. Copy `scripts/publish-mix/.env.example` to `scripts/publish-mix/.env` and fill it in, then:

```bash
cd scripts/publish-mix && npm install && cd -
npm run publish-mix -- ~/Music/ok-sessions-132.wav --number 132 --genre House --dry-run
npm run publish-mix -- ~/Music/ok-sessions-132.wav --number 132 --genre House
```

This encodes an AAC (256k, faststart) stream and a 320k MP3 download, generates waveform peaks, uploads them to R2 under content-hashed keys, and registers the mix. Re-running with the same master skips the encode. Themes come from `shared/mix-themes.json`; for a new session add an entry there or pass `--bg`/`--fg`/`--dark`. Use `--draft` to upload without publishing.

### Backfilling from SoundCloud

```bash
npm run export-soundcloud-manifest -- scripts/publish-mix/manifest.json
```

This writes a manifest with each mix's title, description and SoundCloud link. Fill in each `file` with the path to its master (relative to the manifest), then:

```bash
npm run publish-mix -- --batch scripts/publish-mix/manifest.json --dry-run
npm run publish-mix -- --batch scripts/publish-mix/manifest.json
```

The SoundCloud export only works while the old `/api/soundcloud` function is still deployed, so run it before deploying this version of the site.
