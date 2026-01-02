import type { Handler, HandlerEvent } from "@netlify/functions";
import { cacheHeaders, fetchWithCache, getCacheStatus } from "@netlify/cache";

type CacheStatus = ReturnType<typeof getCacheStatus>;

type SoundCloudUser = {
  id: number | string;
  username: string;
  permalink_url?: string;
};

type SoundCloudTrack = {
  id: number | string;
  urn: string;
  title: string;
  description: string;
  permalink_url?: string;
  duration?: number;
  stream_url: string;
  artwork_url?: string;
  waveform_url?: string;
  streamable?: boolean;
  playback_count?: number;
  user?: SoundCloudUser;
};

type SoundCloudPlaylist = {
  kind: string;
  id: number | string;
  title: string;
  permalink_url?: string;
  track_count?: number;
  artwork_url?: string;
  description?: string;
  genre?: string;
  last_modified?: string;
  sharing?: string;
  public?: boolean;
  user?: SoundCloudUser;
};

type LinkedPartitioning<T> = {
  collection: T[];
  next_href: string | null;
};

let cachedTokenMeta: { accessToken: string; expiresAtMs: number } | null = null;

const PLAYLIST_URL = "https://soundcloud.com/olliekav/sets/ok-sessions";

const TTL_RESOLVE_SECONDS = 12 * 60 * 60; // 12h
const TTL_PLAYLIST_META_SECONDS = 30 * 60; // 30m
const TTL_TRACKS_SECONDS = 10 * 60; // 10m

const TRACKS_PAGE_LIMIT = 200;
const MAX_PAGES = 25;
const MAX_TRACKS = 2000;

function json(statusCode: number, body: unknown, headers?: Record<string, string>) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "cache-control": "no-store",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  };
}

function base64(str: string) {
  return Buffer.from(str, "utf8").toString("base64");
}

async function getClientCredentialsToken(): Promise<string> {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing env vars: SOUNDCLOUD_CLIENT_ID and/or SOUNDCLOUD_CLIENT_SECRET");
  }

  const now = Date.now();
  if (cachedTokenMeta && cachedTokenMeta.expiresAtMs > now + 15_000) {
    return cachedTokenMeta.accessToken;
  }

  const res = await fetch("https://secure.soundcloud.com/oauth/token", {
    method: "POST",
    headers: {
      accept: "application/json; charset=utf-8",
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${base64(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token || !data.expires_in) {
    throw new Error("Token response missing access_token/expires_in");
  }

  cachedTokenMeta = {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + data.expires_in * 1000,
  };

  return cachedTokenMeta.accessToken;
}

async function scGetCached<T>(
  url: string,
  args: { accessToken: string; ttlSeconds: number; tags: string[] }
): Promise<T> {
  const req = new Request(url, {
    headers: {
      accept: "application/json; charset=utf-8",
      authorization: `OAuth ${args.accessToken}`,
    },
  });

  const res = await fetchWithCache(req, { ttl: args.ttlSeconds, tags: args.tags });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SoundCloud request failed: ${res.status} ${text}`);
  }

  return (await res.json()) as T;
}

function normalizePlaylist(p: SoundCloudPlaylist) {
  return {
    id: p.id,
    title: p.title,
    permalink_url: p.permalink_url,
    track_count: p.track_count,
    artwork_url: p.artwork_url,
    description: p.description,
    genre: p.genre,
    last_modified: p.last_modified,
    public: p.sharing === "public" || p.public === true,
    user: p.user
      ? { id: p.user.id, username: p.user.username, permalink_url: p.user.permalink_url }
      : null,
  };
}

function normalizeTrack(t: SoundCloudTrack) {
  return {
    id: t.id,
    urn: t.urn,
    title: t.title,
    description: t.title,
    permalink_url: t.permalink_url,
    duration_ms: t.duration,
    stream_url: t.stream_url,
    artwork_url: t.artwork_url,
    waveform_url: t.waveform_url,
    streamable: t.streamable,
    playback_count: t.playback_count,
    user: t.user ? { id: t.user.id, username: t.user.username, permalink_url: t.user.permalink_url } : null,
  };
}

function unwrapCollection<T>(payload: unknown): LinkedPartitioning<T> {
  if (Array.isArray(payload)) return { collection: payload as T[], next_href: null };

  const p = payload as Partial<{ collection: T[]; next_href: string | null }>;
  return {
    collection: Array.isArray(p.collection) ? p.collection : [],
    next_href: p.next_href ?? null,
  };
}

async function resolvePlaylist(accessToken: string): Promise<{ playlistId: string | number }> {
  const resolveUrl = `https://api.soundcloud.com/resolve?${new URLSearchParams({
    url: PLAYLIST_URL,
  }).toString()}`;

  const resolved = await scGetCached<Partial<SoundCloudPlaylist>>(resolveUrl, {
    accessToken,
    ttlSeconds: TTL_RESOLVE_SECONDS,
    tags: ["soundcloud", "resolve", "playlist"],
  });

  if (!resolved?.id || resolved.kind !== "playlist") {
    throw new Error(`PLAYLIST_URL did not resolve to a playlist (kind=${resolved.kind ?? "unknown"})`);
  }

  return { playlistId: resolved.id };
}

async function fetchPlaylistMeta(accessToken: string, playlistId: string | number): Promise<SoundCloudPlaylist> {
  const url = `https://api.soundcloud.com/playlists/${encodeURIComponent(String(playlistId))}?${new URLSearchParams({
    show_tracks: "false",
  }).toString()}`;

  return scGetCached<SoundCloudPlaylist>(url, {
    accessToken,
    ttlSeconds: TTL_PLAYLIST_META_SECONDS,
    tags: ["soundcloud", `playlist:${playlistId}`, "meta"],
  });
}

async function fetchAllTracks(
  accessToken: string,
  playlistId: string | number
): Promise<SoundCloudTrack[]> {
  let nextUrl: string | null = `https://api.soundcloud.com/playlists/${encodeURIComponent(
    String(playlistId)
  )}/tracks?${new URLSearchParams({
    limit: String(TRACKS_PAGE_LIMIT),
    linked_partitioning: "true",
  }).toString()}`;

  const all: SoundCloudTrack[] = [];
  let pages = 0;

  while (nextUrl && pages < MAX_PAGES && all.length < MAX_TRACKS) {
    const pagePayload: unknown = await scGetCached<unknown>(nextUrl, {
      accessToken,
      ttlSeconds: TTL_TRACKS_SECONDS,
      tags: ["soundcloud", `playlist:${playlistId}`, "tracks"],
    });

    const { collection, next_href } = unwrapCollection<SoundCloudTrack>(pagePayload);

    const remaining = MAX_TRACKS - all.length;
    all.push(...collection.slice(0, remaining));

    nextUrl = next_href;
    pages += 1;
  }

  return all;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type, authorization",
      },
      body: "",
    };
  }

  try {
    const accessToken = await getClientCredentialsToken();

    const { playlistId } = await resolvePlaylist(accessToken);

    const [playlistMeta, tracks] = await Promise.all([
      fetchPlaylistMeta(accessToken, playlistId),
      fetchAllTracks(accessToken, playlistId),
    ]);

    const responseHeaders = {
      ...cacheHeaders({
        ttl: 5 * 60,
        vary: { query: false },
        tags: ["soundcloud", `playlist:${playlistId}`],
      }),
    };

    return json(
      200,
      {
        playlist_url: PLAYLIST_URL,
        playlist: normalizePlaylist(playlistMeta),
        tracks_count: tracks.length,
        tracks: tracks.map(normalizeTrack),
        token: cachedTokenMeta?.accessToken
      },
      responseHeaders
    );
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
};
