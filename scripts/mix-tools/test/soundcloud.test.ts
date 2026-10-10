import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createSoundCloud, PLAYLIST_URL } from '../soundcloud.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Routes requests by URL prefix and records them. */
const router = (routes: Record<string, () => Response>) =>
  vi.fn<typeof fetch>(async input => {
    const url = String(input);
    const match = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find(prefix => url.startsWith(prefix));
    if (!match) throw new Error(`Unexpected request ${url}`);
    return routes[match]!();
  });

const token = () => json({ access_token: 'tok', expires_in: 3600 });

describe('createSoundCloud', () => {
  it('resolves the playlist and follows pagination', async () => {
    const fetchFn = router({
      'https://secure.soundcloud.com/oauth/token': token,
      'https://api.soundcloud.com/resolve': () => json({ id: 42, kind: 'playlist' }),
      'https://api.soundcloud.com/playlists/42/tracks?': () =>
        json({ collection: [{ title: 'One' }], next_href: 'https://api.soundcloud.com/playlists/42/tracks/page2' }),
      'https://api.soundcloud.com/playlists/42/tracks/page2': () => json({ collection: [{ title: 'Two' }], next_href: null })
    });
    const sc = createSoundCloud({ clientId: 'id', clientSecret: 'secret', fetchFn });

    const tracks = await sc.playlistTracks();
    expect(tracks.map(t => t.title)).toEqual(['One', 'Two']);

    const [tokenUrl, tokenInit] = fetchFn.mock.calls[0]!;
    expect(tokenUrl).toBe('https://secure.soundcloud.com/oauth/token');
    expect(new Headers(tokenInit?.headers).get('authorization')).toBe(`Basic ${btoa('id:secret')}`);
    expect(String(fetchFn.mock.calls[1]![0])).toBe(
      `https://api.soundcloud.com/resolve?${new URLSearchParams({ url: PLAYLIST_URL })}`
    );
    expect(new Headers(fetchFn.mock.calls[1]![1]?.headers).get('authorization')).toBe('OAuth tok');
    // One token for the whole run
    expect(fetchFn.mock.calls.filter(([url]) => String(url).includes('oauth/token'))).toHaveLength(1);
  });

  it('refreshes the token when it is about to expire', async () => {
    let time = 0;
    const fetchFn = router({
      'https://secure.soundcloud.com/oauth/token': token,
      'https://api.soundcloud.com/resolve': () => json({ id: 1, kind: 'playlist' }),
      'https://api.soundcloud.com/playlists/1/tracks': () => json({ collection: [], next_href: null })
    });
    const sc = createSoundCloud({ clientId: 'id', clientSecret: 's', fetchFn, now: () => time });
    await sc.playlistTracks();
    time = 3_590_000;
    await sc.playlistTracks();
    expect(fetchFn.mock.calls.filter(([url]) => String(url).includes('oauth/token'))).toHaveLength(2);
  });

  it('rejects URLs that are not playlists', async () => {
    const fetchFn = router({
      'https://secure.soundcloud.com/oauth/token': token,
      'https://api.soundcloud.com/resolve': () => json({ id: 1, kind: 'track' })
    });
    await expect(createSoundCloud({ clientId: 'i', clientSecret: 's', fetchFn }).playlistTracks('x')).rejects.toThrow(
      'x is not a playlist (kind=track)'
    );
  });

  it.each([
    ['failed token exchange', () => new Response('bad', { status: 401 }), 'token exchange failed: 401 bad'],
    ['incomplete token response', () => json({}), 'missing access_token']
  ])('reports a %s', async (_label, tokenResponse, message) => {
    const fetchFn = router({ 'https://secure.soundcloud.com/oauth/token': tokenResponse });
    await expect(createSoundCloud({ clientId: 'i', clientSecret: 's', fetchFn }).playlistTracks()).rejects.toThrow(message);
  });

  it('reports API errors', async () => {
    const fetchFn = router({
      'https://secure.soundcloud.com/oauth/token': token,
      'https://api.soundcloud.com/resolve': () => json({}, 403)
    });
    await expect(createSoundCloud({ clientId: 'i', clientSecret: 's', fetchFn }).playlistTracks()).rejects.toThrow(
      'SoundCloud request failed: 403'
    );
  });

  it('streams the original upload to disk', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'sc-'));
    const fetchFn = router({
      'https://secure.soundcloud.com/oauth/token': token,
      'https://api.soundcloud.com/tracks/soundcloud%3Atracks%3A7/download': () => new Response('ID3 audio bytes')
    });
    const dest = path.join(dir, 'mix.mp3');
    await createSoundCloud({ clientId: 'i', clientSecret: 's', fetchFn }).downloadOriginal(
      { urn: 'soundcloud:tracks:7', title: 'Seven' },
      dest
    );
    expect(await readFile(dest, 'utf8')).toBe('ID3 audio bytes');
    await rm(dir, { recursive: true });
  });

  it('fails when the download has no body', async () => {
    const fetchFn = router({
      'https://secure.soundcloud.com/oauth/token': token,
      'https://api.soundcloud.com/tracks/': () => new Response(null, { status: 200 })
    });
    await expect(
      createSoundCloud({ clientId: 'i', clientSecret: 's', fetchFn }).downloadOriginal({ urn: 'u', title: 'T' }, '/tmp/x')
    ).rejects.toThrow('No file returned for T');
  });

  it('uploads artwork with the owner token', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => json({}));
    await createSoundCloud({ clientId: 'i', clientSecret: 's', fetchFn }).updateArtwork('soundcloud:tracks:7', Buffer.from('jpeg'), 'user');
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.soundcloud.com/tracks/soundcloud%3Atracks%3A7');
    expect(init?.method).toBe('PUT');
    expect(new Headers(init?.headers).get('authorization')).toBe('OAuth user');
    const file = (init?.body as FormData).get('track[artwork_data]') as File;
    expect(file.type).toBe('image/jpeg');
    expect(await file.text()).toBe('jpeg');
  });

  it('reports artwork failures', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('Pro only', { status: 403 }));
    await expect(
      createSoundCloud({ clientId: 'i', clientSecret: 's', fetchFn }).updateArtwork('u', Buffer.from(''), 't')
    ).rejects.toThrow('Artwork update failed: 403 Pro only');
  });
});
