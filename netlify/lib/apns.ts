import { connect, type ClientHttp2Session } from 'node:http2';
import { createPrivateKey, sign } from 'node:crypto';

// Apple Push Notification service, over HTTP/2 with token-based auth: an ES256 JWT
// signed with the .p8 key from the developer account, sent with every push.

export interface APNsOptions {
  keyId: string;
  teamId: string;
  /** The .p8 key's contents (PEM) */
  key: string;
  /** The app's bundle id, which is the push topic */
  bundleId: string;
  /** api.sandbox.push.apple.com for development builds, api.push.apple.com for TestFlight and the App Store */
  host: string;
  transport?: Transport;
  now?: () => number;
}

export interface APNsResponse {
  status: number;
  body: string;
}

/** Sends one request to APNs. The default is an HTTP/2 session, reused for a run's pushes. */
export interface Transport {
  send(path: string, headers: Record<string, string>, body: string): Promise<APNsResponse>;
  close(): void;
}

export interface Notification {
  title: string;
  body: string;
  /** Extra top-level keys in the payload, read by the app */
  data?: Record<string, unknown>;
  /** Notifications with the same id replace each other on the device */
  collapseId?: string;
}

export type PushResult =
  | { token: string; outcome: 'sent' }
  /** Apple says the token will never work again, so it should be forgotten */
  | { token: string; outcome: 'invalid'; reason: string }
  /** Worth trying again later: a network error, or Apple's 429 or 5xx */
  | { token: string; outcome: 'retry'; reason: string }
  | { token: string; outcome: 'failed'; reason: string };

// Apple rejects tokens older than an hour, and refreshing more than every 20 minutes
const JWT_TTL_MS = 50 * 60 * 1000;
const INVALID_REASONS = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic']);
const CONCURRENCY = 20;

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/** Netlify's UI keeps a pasted key's newlines, but other routes in leave them as "\n". */
const pem = (key: string) => key.replace(/\\n/g, '\n').trim();

export const providerToken = ({ keyId, teamId, key }: Pick<APNsOptions, 'keyId' | 'teamId' | 'key'>, now: number) => {
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: Math.floor(now / 1000) }));
  // JWTs want the raw r‖s signature, not DER
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), {
    key: createPrivateKey(pem(key)),
    dsaEncoding: 'ieee-p1363'
  });
  return `${header}.${claims}.${base64url(signature)}`;
};

export const http2Transport = (origin: string): Transport => {
  let session: ClientHttp2Session | null = null;
  const open = () => {
    if (!session || session.closed || session.destroyed) {
      const current = connect(origin);
      // A failed session fails its requests; forget it so the next push reconnects
      current.on('error', () => {
        if (session === current) session = null;
      });
      session = current;
    }
    return session;
  };
  return {
    send: (path, headers, body) =>
      new Promise((resolve, reject) => {
        const request = open().request({ ':method': 'POST', ':path': path, ...headers });
        let status = 0;
        let data = '';
        request.setEncoding('utf8');
        request.on('response', response => (status = Number(response[':status'])));
        request.on('data', (chunk: string) => (data += chunk));
        request.on('end', () => resolve({ status, body: data }));
        request.on('error', reject);
        request.end(body);
      }),
    close: () => {
      session?.close();
      session = null;
    }
  };
};

export const createAPNs = ({ keyId, teamId, key, bundleId, host, transport, now = Date.now }: APNsOptions) => {
  const http = transport ?? http2Transport(`https://${host}`);
  let jwt: { value: string; createdAt: number } | null = null;

  const authorization = () => {
    if (!jwt || now() - jwt.createdAt > JWT_TTL_MS) {
      jwt = { value: providerToken({ keyId, teamId, key }, now()), createdAt: now() };
    }
    return `bearer ${jwt.value}`;
  };

  const send = async (token: string, notification: Notification, retried = false): Promise<PushResult> => {
    const headers: Record<string, string> = {
      authorization: authorization(),
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      // Keep trying a switched-off phone for a day, then give up
      'apns-expiration': String(Math.floor(now() / 1000) + 24 * 60 * 60)
    };
    if (notification.collapseId) headers['apns-collapse-id'] = notification.collapseId;
    const payload = {
      aps: { alert: { title: notification.title, body: notification.body }, sound: 'default' },
      ...notification.data
    };

    let response: APNsResponse;
    try {
      response = await http.send(`/3/device/${token}`, headers, JSON.stringify(payload));
    } catch (error) {
      return { token, outcome: 'retry', reason: error instanceof Error ? error.message : String(error) };
    }
    if (response.status === 200) return { token, outcome: 'sent' };

    let reason = `HTTP ${response.status}`;
    try {
      reason = (JSON.parse(response.body) as { reason?: string }).reason ?? reason;
    } catch {
      // Not JSON; keep the status
    }
    if (response.status === 410 || INVALID_REASONS.has(reason)) return { token, outcome: 'invalid', reason };
    if (response.status === 403 && reason === 'ExpiredProviderToken' && !retried) {
      jwt = null;
      return send(token, notification, true);
    }
    if (response.status === 429 || response.status >= 500) return { token, outcome: 'retry', reason };
    return { token, outcome: 'failed', reason };
  };

  return {
    send,

    /** Sends to every token, a few at a time over the one connection. */
    async sendAll(tokens: string[], notification: Notification): Promise<PushResult[]> {
      const results: PushResult[] = [];
      for (let i = 0; i < tokens.length; i += CONCURRENCY) {
        results.push(...(await Promise.all(tokens.slice(i, i + CONCURRENCY).map(t => send(t, notification)))));
      }
      return results;
    },

    close: () => http.close()
  };
};

export type APNs = ReturnType<typeof createAPNs>;
