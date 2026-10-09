import { describe, expect, it, vi } from 'vitest';
import fixture from '../../../shared/fixtures/mixes.json';
import { API_URL, fetchMixes, fetchPeaks, fetchStream } from '../api';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchReturning = (response: () => Response) => vi.fn<typeof fetch>(async () => response());

describe('fetchMixes', () => {
  it('returns the playlist in session order', async () => {
    const fetchFn = fetchReturning(() => json(fixture));
    const mixes = await fetchMixes(fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(`${API_URL}/api/mixes`);
    expect(mixes.map(m => m.number)).toEqual([1, 2]);
  });

  it('throws on HTTP errors', async () => {
    await expect(fetchMixes(fetchReturning(() => json({}, 502)))).rejects.toThrow('502');
  });
});

describe('fetchStream', () => {
  it('requests a stream for the track URN', async () => {
    const fetchFn = fetchReturning(() => json({ url: 'https://cdn/x.m3u8', format: 'hls_aac_160' }));
    expect(await fetchStream({ urn: 'soundcloud:tracks:101' }, fetchFn)).toEqual({ url: 'https://cdn/x.m3u8', format: 'hls_aac_160' });
    expect(fetchFn).toHaveBeenCalledWith(`${API_URL}/api/stream?urn=soundcloud%3Atracks%3A101`);
  });
});

describe('fetchPeaks', () => {
  it('normalises SoundCloud samples to one channel of 0–1 peaks', async () => {
    const peaks = await fetchPeaks('https://wave/x.json', fetchReturning(() => json({ width: 3, height: 140, samples: [0, 70, 140] })));
    expect(peaks).toEqual([[0, 0.5, 1]]);
  });

  it('returns undefined without a URL and throws on errors', async () => {
    expect(await fetchPeaks(null)).toBeUndefined();
    await expect(fetchPeaks('https://wave/x.json', fetchReturning(() => json({}, 404)))).rejects.toThrow('404');
  });
});
