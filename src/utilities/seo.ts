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

export const homeHead = (mixes: Mix[]): Head => ({
  title: HOME_TITLE,
  elements: new Set([
    { type: 'link', props: { rel: 'canonical', href: `${SITE_URL}/` } },
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
  track: mixes.map(mix => ({
    '@type': 'MusicRecording',
    name: mix.title,
    url: mix.permalink_url,
    duration: isoDuration(mix.duration_ms),
    byArtist: artist,
    ...(mix.genre && { genre: mix.genre }),
    ...(mix.published_at && { datePublished: mix.published_at.slice(0, 10) }),
    ...(mix.artwork_url && { image: mix.artwork_url })
  }))
});

/** JSON for an inline <script>, which must never contain a closing tag */
export const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
