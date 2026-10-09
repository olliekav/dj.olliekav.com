import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../shared/fixtures/mixes.json';
import { API_URL, fetchMixes, fetchPeaks, getDeviceId, reportDownload, reportPlay } from '../api';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchReturning = (response: () => Response) => vi.fn<typeof fetch>(async () => response());

afterEach(() => localStorage.clear());

describe('getDeviceId', () => {
  it('creates and persists a UUID', () => {
    const id = getDeviceId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDeviceId()).toBe(id);
  });

  it('falls back to memory when storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {}
    };
    const id = getDeviceId(storage);
    expect(getDeviceId(storage)).toBe(id);
  });
});

describe('fetchMixes', () => {
  it('returns mixes in session order', async () => {
    const fetchFn = fetchReturning(() => json(fixture));
    const mixes = await fetchMixes(fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(`${API_URL}/v1/mixes`);
    expect(mixes.map(m => m.number)).toEqual([1, 2, 21]);
  });

  it('throws on HTTP errors', async () => {
    await expect(fetchMixes(fetchReturning(() => json({}, 503)))).rejects.toThrow('503');
  });
});

describe('events', () => {
  it('reports plays, completions and downloads', async () => {
    const fetchFn = fetchReturning(() => json({ counted: true }, 202));
    await reportPlay('ok-sessions-1', {}, fetchFn);
    await reportPlay('ok-sessions-1', { completed: true }, fetchFn);
    await reportDownload('ok-sessions-1', fetchFn);

    const calls = fetchFn.mock.calls.map(([url, init]) => ({ url, init: init!, body: JSON.parse(String(init!.body)) }));
    expect(calls[0]).toMatchObject({
      url: `${API_URL}/v1/mixes/ok-sessions-1/plays`,
      init: { method: 'POST', keepalive: true },
      body: { device_id: getDeviceId(), platform: 'web' }
    });
    expect(calls[1]?.body.completed).toBe(true);
    expect(calls[2]?.url).toBe(`${API_URL}/v1/mixes/ok-sessions-1/downloads`);
  });

  it('swallows network errors', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new Error('offline');
    });
    await expect(reportPlay('x', {}, fetchFn)).resolves.toBeUndefined();
  });
});

describe('fetchPeaks', () => {
  it('wraps peaks as a single channel', async () => {
    const peaks = await fetchPeaks('https://m/p.json', fetchReturning(() => json({ version: 1, peaks: [0.1, 1] })));
    expect(peaks).toEqual([[0.1, 1]]);
  });

  it('returns undefined without a URL and throws on errors', async () => {
    expect(await fetchPeaks(null)).toBeUndefined();
    await expect(fetchPeaks('https://m/p.json', fetchReturning(() => json({}, 404)))).rejects.toThrow('404');
  });
});
