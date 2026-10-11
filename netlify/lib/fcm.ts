import { createPrivateKey, sign } from 'node:crypto';
import type { Notification, PushResult } from './apns';

// Firebase Cloud Messaging (HTTP v1) for the Android app. Authenticates as a service
// account: an RS256 JWT exchanged for a short-lived OAuth access token.

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface FCMOptions {
  /** The service account JSON from Firebase (Project settings → Service accounts) */
  serviceAccount: ServiceAccount;
  fetchFn?: typeof fetch;
  now?: () => number;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
// Google's access tokens last an hour; refresh a little early
const ACCESS_TTL_MS = 50 * 60 * 1000;
const CONCURRENCY = 20;
// The token will never work again (app uninstalled, data cleared), so it should be forgotten.
// Not INVALID_ARGUMENT: that's also what a malformed message gets, and one bug shouldn't wipe every device.
const INVALID_CODES = new Set(['UNREGISTERED', 'SENDER_ID_MISMATCH']);

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/** Pasted keys sometimes keep their newlines as "\n". */
const pem = (key: string) => key.replace(/\\n/g, '\n').trim();

export const parseServiceAccount = (value: string): ServiceAccount => {
  const account = JSON.parse(value) as Partial<ServiceAccount>;
  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error('FCM_SERVICE_ACCOUNT is missing project_id, client_email or private_key');
  }
  return account as ServiceAccount;
};

export const assertion = ({ client_email, private_key }: ServiceAccount, now: number) => {
  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({ iss: client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), createPrivateKey(pem(private_key)));
  return `${header}.${claims}.${base64url(signature)}`;
};

export const createFCM = ({ serviceAccount, fetchFn = fetch, now = Date.now }: FCMOptions) => {
  // Shared by concurrent sends, so a batch makes one token request rather than one each
  let access: { value: Promise<string>; expiresAt: number } | null = null;

  const fetchAccessToken = async () => {
    const res = await fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: assertion(serviceAccount, now())
      }).toString()
    });
    if (!res.ok) throw new Error(`FCM auth failed: ${res.status}`);
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error('FCM auth response missing access_token');
    return data.access_token;
  };

  const accessToken = () => {
    if (!access || access.expiresAt <= now()) {
      const value = fetchAccessToken();
      access = { value, expiresAt: now() + ACCESS_TTL_MS };
      // A failed request isn't kept, so the next send tries again
      value.catch(() => {
        if (access?.value === value) access = null;
      });
    }
    return access.value;
  };

  const url = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

  const send = async (token: string, notification: Notification): Promise<PushResult> => {
    // FCM data values must be strings
    const data = Object.fromEntries(Object.entries(notification.data ?? {}).map(([k, v]) => [k, String(v)]));
    const message = {
      token,
      notification: { title: notification.title, body: notification.body },
      data,
      android: {
        priority: 'normal',
        // Replaces an earlier notification for the same mix
        notification: { tag: notification.collapseId, channel_id: 'new-mixes' },
        ...(notification.collapseId ? { collapse_key: notification.collapseId } : {})
      }
    };
    try {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (res.ok) return { token, outcome: 'sent' };
      if (res.status === 401) access = null;
      const body = (await res.json().catch(() => ({}))) as {
        error?: { status?: string; details?: { errorCode?: string }[] };
      };
      const code = body.error?.details?.find(d => d.errorCode)?.errorCode ?? body.error?.status ?? `HTTP ${res.status}`;
      if (res.status === 404 || INVALID_CODES.has(code)) return { token, outcome: 'invalid', reason: code };
      if (res.status === 429 || res.status >= 500 || res.status === 401) return { token, outcome: 'retry', reason: code };
      return { token, outcome: 'failed', reason: code };
    } catch (error) {
      return { token, outcome: 'retry', reason: error instanceof Error ? error.message : String(error) };
    }
  };

  return {
    async sendAll(tokens: string[], notification: Notification): Promise<PushResult[]> {
      const results: PushResult[] = [];
      for (let i = 0; i < tokens.length; i += CONCURRENCY) {
        results.push(...(await Promise.all(tokens.slice(i, i + CONCURRENCY).map(t => send(t, notification)))));
      }
      return results;
    }
  };
};

export type FCM = ReturnType<typeof createFCM>;
