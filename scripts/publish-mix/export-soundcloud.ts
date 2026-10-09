#!/usr/bin/env node
// Builds a starter batch manifest from the current SoundCloud-backed site so titles,
// descriptions and links carry over. Fill in each "file" with the path to the master.
import { realpathSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

interface SoundCloudTrack {
  title: string;
  description?: string | null;
  genre?: string | null;
  permalink_url: string;
  created_at?: string | null;
}

export const toManifest = (data: { tracks: SoundCloudTrack[] }) =>
  data.tracks.map((track, i) => ({
    file: null,
    number: i + 1,
    title: track.title,
    description: track.description ?? '',
    genre: track.genre || null,
    recorded_at: null,
    published_at: track.created_at ?? null,
    soundcloud_url: track.permalink_url
  }));

export const exportManifest = async ({ url, out, fetchFn = fetch }: { url: string; out: string; fetchFn?: typeof fetch }) => {
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`Fetching ${url} failed: ${res.status}`);
  }
  const manifest = toManifest((await res.json()) as { tracks: SoundCloudTrack[] });
  await writeFile(out, JSON.stringify(manifest, null, 2) + '\n');
  return manifest.length;
};

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const out = process.argv[2] ?? 'manifest.json';
  exportManifest({ url: 'https://dj.olliekav.com/api/soundcloud', out }).then(
    count => console.log(`Wrote ${count} mixes to ${out}; add each master's path as "file"`),
    (error: Error) => {
      console.error(error.message);
      process.exit(1);
    }
  );
}
