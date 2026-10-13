import type { Mix } from '../../shared/api-types';

// Head tags and structured data for the prerendered pages, so search engines and
// link previews see the mixes without running any JavaScript.

export const SITE_URL = 'https://dj.olliekav.com';
export const SITE_NAME = 'OK Sessions';
export const ARTIST = 'Ollie Kav';
export const SOUNDCLOUD_URL = 'https://soundcloud.com/olliekav';
export const PLAYLIST_URL = 'https://soundcloud.com/olliekav/sets/ok-sessions';

export const HOME_TITLE = `${SITE_NAME} · UK bass DJ mixes by ${ARTIST}`;
export const DESCRIPTION =
  'Exploring the world of UK bass music. Leftfield Techno, Drum & Bass, Breakbeats, Dubstep and UK Garage.';

const FALLBACK_IMAGE = `${SITE_URL}/assets/icons/icon-512.png`;

/** An element for vite-prerender-plugin to add to <head> */
export interface HeadElement {
  type: string;
  props: Record<string, string>;
}

export interface Head {
  title: string;
  elements: Set<HeadElement>;
}

const meta = (key: 'name' | 'property', name: string, content: string): HeadElement => ({
  type: 'meta',
  props: { [key]: name, content }
});

/** The newest mix comes first in the playlist */
const shareImage = (mixes: Mix[]) => mixes[0]?.artwork_original_url ?? mixes[0]?.artwork_url ?? FALLBACK_IMAGE;

export const mixPath = (mix: Pick<Mix, 'slug'>) => `/mixes/${encodeURIComponent(mix.slug)}/`;
export const mixUrl = (mix: Pick<Mix, 'slug'>) => `${SITE_URL}${mixPath(mix)}`;

export const mixSlug = (path: string) => {
  const slug = /^\/mixes\/([^/]+)\/?$/.exec(path)?.[1];
  if (!slug) {
    return undefined;
  }
  try {
    return decodeURIComponent(slug);
  } catch {
    return undefined;
  }
};

export const mixTitle = (mix: Mix) =>
  `${SITE_NAME} #${mix.number} · ${mix.genre ? `${mix.genre} ` : ''}DJ mix by ${ARTIST}`;

export const summary = (text: string, max = 160) => {
  const line = text.replace(/\s+/g, ' ').trim();
  if (line.length <= max) {
    return line;
  }
  const cut = line.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
};

export const mixDescription = (mix: Mix) => {
  const lines = mix.description
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, i, all) => (i < all.length - 1 && !/[.!?:,;]$/.test(line) ? `${line},` : line));
  return summary(`${mix.title}: ${mix.genre ? `${mix.genre} ` : ''}DJ mix by ${ARTIST}. ${lines.join(' ')}`);
};

const mixImage = (mix: Mix) => mix.artwork_original_url ?? mix.artwork_url ?? FALLBACK_IMAGE;

export const homeHead = (mixes: Mix[]): Head => ({
  title: HOME_TITLE,
  elements: new Set([
    { type: 'link', props: { rel: 'canonical', href: `${SITE_URL}/` } },
    meta('name', 'description', DESCRIPTION),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:title', HOME_TITLE),
    meta('property', 'og:description', DESCRIPTION),
    meta('property', 'og:url', `${SITE_URL}/`),
    meta('property', 'og:image', shareImage(mixes)),
    meta('property', 'og:locale', 'en_GB'),
    // The artwork is square, which suits the small card
    meta('name', 'twitter:card', 'summary'),
    meta('name', 'twitter:title', HOME_TITLE),
    meta('name', 'twitter:description', DESCRIPTION),
    meta('name', 'twitter:image', shareImage(mixes))
  ])
});

export const mixHead = (mix: Mix): Head => {
  const title = mixTitle(mix);
  const description = mixDescription(mix);
  const url = mixUrl(mix);
  return {
    title,
    elements: new Set([
      { type: 'link', props: { rel: 'canonical', href: url } },
      meta('name', 'description', description),
      meta('property', 'og:type', 'music.song'),
      meta('property', 'og:site_name', SITE_NAME),
      meta('property', 'og:title', title),
      meta('property', 'og:description', description),
      meta('property', 'og:url', url),
      meta('property', 'og:image', mixImage(mix)),
      meta('property', 'og:image:alt', `${mix.title} artwork`),
      meta('property', 'og:locale', 'en_GB'),
      meta('property', 'music:duration', String(Math.round(mix.duration_ms / 1000))),
      meta('property', 'music:musician', `${SITE_URL}/`),
      ...(mix.published_at ? [meta('property', 'music:release_date', mix.published_at.slice(0, 10))] : []),
      meta('name', 'twitter:card', 'summary'),
      meta('name', 'twitter:title', title),
      meta('name', 'twitter:description', description),
      meta('name', 'twitter:image', mixImage(mix))
    ])
  };
};

export const notFoundHead = (): Head => ({
  title: `Not found · ${SITE_NAME}`,
  elements: new Set([meta('name', 'robots', 'noindex')])
});

/** ISO 8601 duration, e.g. PT1H2M5S */
export const isoDuration = (ms: number) => {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s || total === 0 ? `${s}S` : ''}`;
};

const artist = {
  '@type': 'Person',
  name: ARTIST,
  url: `${SITE_URL}/`,
  sameAs: [SOUNDCLOUD_URL]
};

const recording = (mix: Mix) => ({
  '@type': 'MusicRecording',
  name: mix.title,
  url: mixUrl(mix),
  sameAs: [mix.permalink_url],
  duration: isoDuration(mix.duration_ms),
  byArtist: artist,
  ...(mix.genre && { genre: mix.genre }),
  ...(mix.published_at && { datePublished: mix.published_at.slice(0, 10) }),
  ...(mix.artwork_url && { image: mix.artwork_url })
});

/** schema.org MusicPlaylist for the home page */
export const playlistJsonLd = (mixes: Mix[]) => ({
  '@context': 'https://schema.org',
  '@type': 'MusicPlaylist',
  name: SITE_NAME,
  description: DESCRIPTION,
  url: `${SITE_URL}/`,
  sameAs: [PLAYLIST_URL],
  author: artist,
  numTracks: mixes.length,
  track: mixes.map(recording)
});

export const mixJsonLd = (mix: Mix) => ({
  '@context': 'https://schema.org',
  ...recording(mix),
  ...(mix.description.trim() && { description: mix.description.trim() }),
  ...(mix.artwork_original_url && { image: mix.artwork_original_url }),
  inPlaylist: { '@type': 'MusicPlaylist', name: SITE_NAME, url: `${SITE_URL}/` }
});

export const headFor = (path: string, mixes: Mix[]): Head => {
  if (path === '/') {
    return homeHead(mixes);
  }
  const slug = mixSlug(path);
  const mix = slug === undefined ? undefined : mixes.find(m => m.slug === slug);
  return mix ? mixHead(mix) : notFoundHead();
};

/** JSON for an inline <script>, which must never contain a closing tag */
export const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
