import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { authorizeUrl, createPkce, exchangeCode, REDIRECT_URI, signIn, waitForCode } from '../soundcloud-auth.ts';

const port = () => 20_000 + Math.floor(Math.random() * 20_000);

describe('createPkce', () => {
  it('derives the S256 challenge from the verifier', () => {
    const { verifier, challenge, state } = createPkce();
    expect(verifier).toMatch(/^[\w-]{64}$/);
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
    expect(state).not.toBe(verifier);
  });
});

describe('authorizeUrl', () => {
  it('requests a code with PKCE', () => {
    const url = new URL(authorizeUrl('client', 'challenge', 'state'));
    expect(url.origin + url.pathname).toBe('https://secure.soundcloud.com/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client',
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      state: 'state'
    });
  });
});

describe('waitForCode', () => {
  it('resolves with the code when the state matches', async () => {
    const p = port();
    const code = waitForCode('abc', { port: p });
    await vi.waitFor(async () => {
      const res = await fetch(`http://127.0.0.1:${p}/callback?state=abc&code=the-code`);
      expect(await res.text()).toContain('You can close this tab');
    });
    expect(await code).toBe('the-code');
  });

  it.each([
    ['a state mismatch', 'state=wrong&code=x', 'state mismatch'],
    ['a denied sign-in', 'error=access_denied&error_description=User+denied', 'User denied']
  ])('rejects %s', async (_label, query, message) => {
    const p = port();
    const code = waitForCode('abc', { port: p });
    const outcome = expect(code).rejects.toThrow(message);
    await vi.waitFor(() => fetch(`http://127.0.0.1:${p}/callback?${query}`));
    await outcome;
  });

  it('ignores other paths and times out', async () => {
    const p = port();
    const code = waitForCode('abc', { port: p, timeoutMs: 300 });
    const outcome = expect(code).rejects.toThrow('Timed out');
    await vi.waitFor(async () => expect((await fetch(`http://127.0.0.1:${p}/favicon.ico`)).status).toBe(404));
    await outcome;
  });
});

describe('exchangeCode', () => {
  it('exchanges the code and verifier for a token', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ access_token: 'user-token' })));
    expect(await exchangeCode({ clientId: 'id', clientSecret: 's', code: 'c', verifier: 'v', fetchFn })).toBe('user-token');
    const body = new URLSearchParams(String(fetchFn.mock.calls[0]![1]?.body));
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'authorization_code',
      client_id: 'id',
      client_secret: 's',
      redirect_uri: REDIRECT_URI,
      code_verifier: 'v',
      code: 'c'
    });
  });

  it.each([
    [new Response('nope', { status: 400 }), 'token exchange failed: 400 nope'],
    [new Response('{}'), 'missing access_token']
  ])('reports failures', async (response, message) => {
    await expect(exchangeCode({ clientId: 'i', clientSecret: 's', code: 'c', verifier: 'v', fetchFn: async () => response })).rejects.toThrow(
      message
    );
  });
});

describe('signIn', () => {
  it('opens the browser, waits for the code and exchanges it', async () => {
    const open = vi.fn<(url: string) => void>();
    const wait = vi.fn(async (_state: string) => 'code');
    const exchange = vi.fn(async (_args: { clientId: string; clientSecret: string; code: string; verifier: string }) => 'token');
    const log = vi.fn();
    expect(await signIn({ clientId: 'id', clientSecret: 's', log, open, wait, exchange })).toBe('token');
    const url = new URL(open.mock.calls[0]![0]);
    expect(url.searchParams.get('state')).toBe(wait.mock.calls[0]![0]);
    expect(exchange.mock.calls[0]![0]).toMatchObject({ clientId: 'id', clientSecret: 's', code: 'code' });
    expect(log.mock.calls[0]![0]).toContain('Sign in to SoundCloud');
  });
});
