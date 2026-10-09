import { describe, expect, it } from 'vitest';
import { adminGet, mixInput, putMix, request } from './helpers';

describe('admin auth', () => {
  it.each([
    ['no header', undefined],
    ['wrong scheme', 'Basic test-admin-token'],
    ['wrong token', 'Bearer nope']
  ])('rejects %s', async (_label, authorization) => {
    const res = await request('/v1/admin/mixes', {
      headers: authorization ? { authorization } : {}
    });
    expect(res.status).toBe(401);
  });

  it('accepts the admin token', async () => {
    expect((await adminGet('/v1/admin/mixes')).status).toBe(200);
  });
});

describe('PUT /v1/admin/mixes/:slug', () => {
  it('creates and updates a mix', async () => {
    const created = await putMix('ok-sessions-1', mixInput({ status: 'draft', published_at: null }));
    expect(created.status).toBe(200);
    const draft = (await created.json<{ mix: any }>()).mix;
    expect(draft).toMatchObject({ status: 'draft', published_at: null });

    const updated = await putMix('ok-sessions-1', mixInput({ title: 'Renamed', published_at: null }));
    const mix = (await updated.json<{ mix: any }>()).mix;
    expect(mix).toMatchObject({ title: 'Renamed', status: 'published', id: draft.id });
    expect(mix.published_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Republishing keeps the original publish date
    const again = await putMix('ok-sessions-1', mixInput({ published_at: '2030-01-01' }));
    expect((await again.json<{ mix: any }>()).mix.published_at).toBe(mix.published_at);
  });

  it('lists drafts for admins', async () => {
    await putMix('ok-sessions-1', mixInput({ status: 'draft' }));
    const body = await (await adminGet('/v1/admin/mixes')).json<{ mixes: any[] }>();
    expect(body.mixes).toEqual([expect.objectContaining({ slug: 'ok-sessions-1', status: 'draft' })]);
  });

  it('validates the body', async () => {
    const res = await putMix('ok-sessions-1', { ...mixInput(), theme: { background: 'red' } });
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string; issues: unknown[] }>();
    expect(body.error).toBe('Invalid request');
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it('rejects invalid JSON', async () => {
    const res = await request('/v1/admin/mixes/ok-sessions-1', {
      method: 'PUT',
      headers: { authorization: 'Bearer test-admin-token' },
      body: '{'
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
  });

  it('rejects invalid slugs', async () => {
    expect((await putMix('Bad Slug', mixInput())).status).toBe(400);
  });

  it('rejects duplicate mix numbers', async () => {
    await putMix('ok-sessions-1', mixInput());
    const res = await putMix('another', mixInput());
    expect(res.status).toBe(409);
  });
});
