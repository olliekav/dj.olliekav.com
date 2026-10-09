import { describe, expect, it } from 'vitest';
import { createApi, type MixInput } from '../api.ts';
import { jsonResponse, mockFetch } from './helpers.ts';

const input = { number: 1 } as MixInput;

describe('createApi', () => {
  it('PUTs the mix with admin and Access headers', async () => {
    const fetchFn = mockFetch(() => jsonResponse(200, { mix: { slug: 'x' } }));
    const api = createApi({
      baseUrl: 'https://api.olliekav.com/',
      adminToken: 'secret',
      accessClientId: 'id',
      accessClientSecret: 'cs',
      fetchFn
    });
    expect(await api.putMix('x', input)).toEqual({ slug: 'x' });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.olliekav.com/v1/admin/mixes/x');
    expect(init?.method).toBe('PUT');
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer secret',
      'CF-Access-Client-Id': 'id',
      'CF-Access-Client-Secret': 'cs'
    });
    expect(JSON.parse(String(init?.body))).toEqual({ number: 1 });
  });

  it('omits Access headers when not configured', async () => {
    const fetchFn = mockFetch(() => jsonResponse(200, { mix: {} }));
    await createApi({ baseUrl: 'https://a', adminToken: 't', fetchFn }).putMix('x', input);
    expect(fetchFn.mock.calls[0]![1]?.headers).not.toHaveProperty('CF-Access-Client-Id');
  });

  it('surfaces validation issues', async () => {
    const fetchFn = mockFetch(() => jsonResponse(400, { error: 'Invalid request', issues: [{ path: ['theme'] }] }));
    await expect(createApi({ baseUrl: 'https://a', adminToken: 't', fetchFn }).putMix('x', input)).rejects.toThrow(
      /API 400: Invalid request\n.*theme/s
    );
  });

  it('lists mixes including drafts', async () => {
    const fetchFn = mockFetch(() => jsonResponse(200, { mixes: [{ slug: 'x', status: 'draft' }] }));
    expect(await createApi({ baseUrl: 'https://a/', adminToken: 't', fetchFn }).listMixes()).toEqual([
      { slug: 'x', status: 'draft' }
    ]);
    expect(fetchFn.mock.calls[0]![0]).toBe('https://a/v1/admin/mixes');
  });

  it('handles non-JSON errors', async () => {
    const fetchFn = mockFetch(() => jsonResponse(502));
    await expect(createApi({ baseUrl: 'https://a', adminToken: 't', fetchFn }).putMix('x', input)).rejects.toThrow(
      'API 502: Status'
    );
  });
});
