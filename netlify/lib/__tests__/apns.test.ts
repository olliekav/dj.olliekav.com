// @vitest-environment node
import { createServer, type Http2Server } from 'node:http2';
import { verify } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createAPNs, http2Transport, providerToken, type APNsResponse } from '../apns';
import { fakeTransport, testKey, testPublicKey as publicKey } from './helpers';

const TOKEN = 'a'.repeat(64);

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString()) as Record<string, unknown>;


const apns = (transport: ReturnType<typeof fakeTransport>, now = () => 1_700_000_000_000) =>
  createAPNs({ keyId: 'KEY123', teamId: 'TEAM456', key: testKey, bundleId: 'com.olliekav.oksessions', host: 'x', transport, now });

const notification = { title: 'OK Sessions #3 is out', body: 'A new mix', data: { mix: 3 }, collapseId: 'mix-3' };

describe('providerToken', () => {
  it('is an ES256 JWT naming the key and team, signed with the key', () => {
    const jwt = providerToken({ keyId: 'KEY123', teamId: 'TEAM456', key: testKey }, 1_700_000_000_999);
    const [header, claims, signature] = jwt.split('.') as [string, string, string];
    expect(decode(header)).toEqual({ alg: 'ES256', kid: 'KEY123' });
    expect(decode(claims)).toEqual({ iss: 'TEAM456', iat: 1_700_000_000 });
    const valid = verify(
      'sha256',
      Buffer.from(`${header}.${claims}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signature, 'base64url')
    );
    expect(valid).toBe(true);
  });

  it('accepts a key whose newlines were escaped', () => {
    const escaped = testKey.trim().replace(/\n/g, '\\n');
    expect(() => providerToken({ keyId: 'k', teamId: 't', key: escaped }, 0)).not.toThrow();
  });
});

describe('createAPNs', () => {
  it('sends an alert to the device, for the app, with the custom payload', async () => {
    const transport = fakeTransport({ status: 200, body: '' });
    expect(await apns(transport).send(TOKEN, notification)).toEqual({ token: TOKEN, outcome: 'sent' });
    const [request] = transport.sent;
    expect(request?.path).toBe(`/3/device/${TOKEN}`);
    expect(request?.headers).toMatchObject({
      'apns-topic': 'com.olliekav.oksessions',
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-collapse-id': 'mix-3',
      'apns-expiration': String(1_700_000_000 + 86_400)
    });
    expect(request?.headers.authorization).toMatch(/^bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    expect(request?.body).toEqual({
      aps: { alert: { title: 'OK Sessions #3 is out', body: 'A new mix' }, sound: 'default' },
      mix: 3
    });
  });

  it('reuses the provider token for 50 minutes', async () => {
    let now = 0;
    const transport = fakeTransport();
    const client = apns(transport, () => now);
    await client.send(TOKEN, notification);
    now = 49 * 60_000;
    await client.send(TOKEN, notification);
    now = 51 * 60_000;
    await client.send(TOKEN, notification);
    const [first, second, third] = transport.sent.map(r => r.headers.authorization);
    expect(second).toBe(first);
    expect(third).not.toBe(first);
  });

  it('sorts failures into invalid tokens, retryable and permanent', async () => {
    const reason = (status: number, r?: string) => ({ status, body: r ? JSON.stringify({ reason: r }) : '' });
    const outcome = async (response: APNsResponse | Error) => (await apns(fakeTransport(response)).send(TOKEN, notification));
    expect(await outcome(reason(410, 'Unregistered'))).toMatchObject({ outcome: 'invalid', reason: 'Unregistered' });
    expect(await outcome(reason(400, 'BadDeviceToken'))).toMatchObject({ outcome: 'invalid' });
    expect(await outcome(reason(400, 'DeviceTokenNotForTopic'))).toMatchObject({ outcome: 'invalid' });
    expect(await outcome(reason(400, 'PayloadTooLarge'))).toMatchObject({ outcome: 'failed', reason: 'PayloadTooLarge' });
    expect(await outcome(reason(429, 'TooManyRequests'))).toMatchObject({ outcome: 'retry' });
    expect(await outcome(reason(503))).toMatchObject({ outcome: 'retry', reason: 'HTTP 503' });
    expect(await outcome(new Error('ECONNRESET'))).toMatchObject({ outcome: 'retry', reason: 'ECONNRESET' });
  });

  it('signs a new provider token once when Apple says it expired', async () => {
    const renewed = fakeTransport({ status: 403, body: '{"reason":"ExpiredProviderToken"}' }, { status: 200, body: '' });
    expect(await apns(renewed).send(TOKEN, notification)).toMatchObject({ outcome: 'sent' });
    const [first, second] = renewed.sent.map(r => r.headers.authorization);
    expect(second).not.toBe(first);

    const expired = fakeTransport({ status: 403, body: '{"reason":"ExpiredProviderToken"}' });
    expect(await apns(expired).send(TOKEN, notification)).toMatchObject({ outcome: 'failed' });
    expect(expired.sent).toHaveLength(2);
  });

  it('sends to every token', async () => {
    const transport = fakeTransport();
    const tokens = Array.from({ length: 45 }, (_, i) => i.toString(16).padStart(64, '0'));
    const results = await apns(transport).sendAll(tokens, notification);
    expect(results.map(r => r.token)).toEqual(tokens);
    expect(transport.send).toHaveBeenCalledTimes(45);
  });
});

describe('http2Transport', () => {
  let server: Http2Server | undefined;
  afterEach(() => new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve())));

  it('POSTs over one HTTP/2 connection and returns the status and body', async () => {
    const received: { path?: string; topic?: string; body: string }[] = [];
    server = createServer();
    let sessions = 0;
    server.on('session', () => sessions++);
    server.on('stream', (stream, headers) => {
      let body = '';
      stream.on('data', chunk => (body += chunk));
      stream.on('end', () => {
        received.push({ path: headers[':path'], topic: headers['apns-topic'] as string, body });
        stream.respond({ ':status': body === 'bad' ? 400 : 200 });
        stream.end(body === 'bad' ? '{"reason":"BadDeviceToken"}' : '');
      });
    });
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    // Cleartext HTTP/2 locally; APNs is the same over TLS
    const transport = http2Transport(`http://127.0.0.1:${port}`);
    expect(await transport.send('/3/device/abc', { 'apns-topic': 'app' }, '{}')).toEqual({ status: 200, body: '' });
    expect(await transport.send('/3/device/def', {}, 'bad')).toEqual({ status: 400, body: '{"reason":"BadDeviceToken"}' });
    transport.close();
    expect(received).toEqual([
      { path: '/3/device/abc', topic: 'app', body: '{}' },
      { path: '/3/device/def', topic: undefined, body: 'bad' }
    ]);
    expect(sessions).toBe(1);
  });

  it('rejects when it cannot connect, then reconnects', async () => {
    const transport = http2Transport('http://127.0.0.1:1');
    await expect(transport.send('/3/device/abc', {}, '{}')).rejects.toThrow();
    await expect(transport.send('/3/device/abc', {}, '{}')).rejects.toThrow();
    transport.close();
  });
});
