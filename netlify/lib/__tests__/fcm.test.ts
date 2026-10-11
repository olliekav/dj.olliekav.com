// @vitest-environment node
import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { assertion, createFCM, parseServiceAccount } from '../fcm';
import { json, router } from './helpers';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const serviceAccount = {
  project_id: 'ok-sessions',
  client_email: 'push@ok-sessions.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
};
const TOKEN = `${'f'.repeat(20)  }:APA91b${  'x'.repeat(140)}`;
const notification = { title: 'OK Sessions #2 is out', body: 'A new mix from O:K. Tap to listen.', data: { mix: 2 }, collapseId: 'mix-2' };
const SEND = 'https://fcm.googleapis.com/v1/projects/ok-sessions/messages:send';

const setup = (...responses: (Response | Error)[]) => {
  const sends: { headers: Headers; body: { message: Record<string, unknown> } }[] = [];
  const fetchFn = router({
    'https://oauth2.googleapis.com/token': () => json({ access_token: 'access-1', expires_in: 3600 }),
    [SEND]: (_url, init) => {
      sends.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      const next = responses.shift() ?? json({ name: 'projects/ok-sessions/messages/1' });
      if (next instanceof Error) throw next;
      return next;
    }
  });
  return { fcm: createFCM({ serviceAccount, fetchFn, now: () => 1_000_000 }), fetchFn, sends };
};

describe('fcm', () => {
  it('signs a service account assertion Google can verify', () => {
    const [header, claims, signature] = assertion(serviceAccount, 1_000_000).split('.');
    expect(JSON.parse(Buffer.from(claims!, 'base64url').toString())).toEqual({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1000,
      exp: 4600
    });
    expect(verify('sha256', Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature!, 'base64url'))).toBe(true);
  });

  it('reads the service account JSON and refuses one that is incomplete', () => {
    expect(parseServiceAccount(JSON.stringify(serviceAccount)).project_id).toBe('ok-sessions');
    expect(() => parseServiceAccount('{"project_id":"x"}')).toThrow(/missing/);
  });

  it('sends a notification with the mix number, reusing the access token', async () => {
    const { fcm, fetchFn, sends } = setup();
    expect(await fcm.sendAll([TOKEN, TOKEN], notification)).toEqual([
      { token: TOKEN, outcome: 'sent' },
      { token: TOKEN, outcome: 'sent' }
    ]);
    expect(fetchFn.mock.calls.filter(([url]) => String(url).includes('oauth2'))).toHaveLength(1);
    expect(sends[0]!.headers.get('authorization')).toBe('Bearer access-1');
    expect(sends[0]!.body.message).toEqual({
      token: TOKEN,
      notification: { title: notification.title, body: notification.body },
      data: { mix: '2' },
      android: { priority: 'normal', notification: { tag: 'mix-2', channel_id: 'new-mixes' }, collapse_key: 'mix-2' }
    });
  });

  it('sorts errors: gone tokens are forgotten, outages retried, bad messages kept', async () => {
    const error = (status: number, code: string) =>
      json({ error: { status: code, details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: code }] } }, status);
    const { fcm } = setup(
      error(404, 'UNREGISTERED'),
      error(403, 'SENDER_ID_MISMATCH'),
      error(400, 'INVALID_ARGUMENT'),
      error(429, 'QUOTA_EXCEEDED'),
      error(503, 'UNAVAILABLE'),
      new Error('ECONNRESET')
    );
    const outcomes = [];
    for (let i = 0; i < 6; i++) outcomes.push((await fcm.sendAll([TOKEN], notification))[0]!.outcome);
    expect(outcomes).toEqual(['invalid', 'invalid', 'failed', 'retry', 'retry', 'retry']);
  });

  it('fails clearly when Google refuses the service account', async () => {
    const fcm = createFCM({
      serviceAccount,
      fetchFn: vi.fn<typeof fetch>(async () => json({ error: 'invalid_grant' }, 400))
    });
    expect((await fcm.sendAll([TOKEN], notification))[0]).toMatchObject({ outcome: 'retry', reason: 'FCM auth failed: 400' });
  });
});
