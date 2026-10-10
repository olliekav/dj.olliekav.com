import type { DeviceRegistration, Mix, NewMixPayload } from '../../shared/api-types';
import type { APNs, Notification } from './apns';
import { fetchAndStoreMixes, json } from './handlers';
import type { SoundCloud, TokenStore } from './soundcloud';

// Push notifications for new mixes: the app registers its APNs token, and an hourly
// check notifies every registered device when the playlist gains a mix.

/** Netlify Blobs' "push" store: a blob per device, plus the newest mix already announced. */
export interface PushStore extends TokenStore {
  delete(key: string): Promise<unknown>;
  list(options: { prefix: string }): Promise<{ blobs: { key: string }[] }>;
}

interface DeviceRecord {
  platform: DeviceRegistration['platform'];
  registeredAt: string;
}

interface LastSeen {
  id: number;
  number: number;
}

const DEVICES = 'devices/';
const LAST_SEEN = 'last-seen';
// APNs tokens are 32 bytes today; Apple says not to rely on the length, so allow longer
const TOKEN = /^[0-9a-f]{64,200}$/;
const MAX_BODY = 1024;
// If the playlist ever jumps by more than this, only the newest are announced
const MAX_PER_RUN = 3;

const deviceKey = (token: string) => `${DEVICES}${token}`;

export const handleDevices = async (request: Request, { store, now = Date.now() }: { store: PushStore; now?: number }) => {
  if (request.method !== 'POST' && request.method !== 'DELETE') {
    return json({ error: 'Use POST or DELETE' }, 405, { allow: 'POST, DELETE' });
  }
  const text = await request.text();
  if (text.length > MAX_BODY) {
    return json({ error: 'Too large' }, 413);
  }
  let body: Partial<DeviceRegistration>;
  try {
    body = JSON.parse(text) as Partial<DeviceRegistration>;
  } catch {
    return json({ error: 'Expected JSON' }, 400);
  }
  const token = typeof body?.token === 'string' ? body.token.toLowerCase() : '';
  if (!TOKEN.test(token)) {
    return json({ error: 'Expected a hex APNs device token' }, 400);
  }
  if (request.method === 'POST' && body.platform !== 'ios') {
    return json({ error: 'Expected platform "ios"' }, 400);
  }
  try {
    if (request.method === 'POST') {
      const record: DeviceRecord = { platform: 'ios', registeredAt: new Date(now).toISOString() };
      await store.setJSON(deviceKey(token), record);
    } else {
      await store.delete(deviceKey(token));
    }
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return json({ error: "Couldn't save the device" }, 502, { 'cache-control': 'no-store' });
  }
};

export const notificationFor = (mix: Mix): Notification => ({
  title: `OK Sessions #${mix.number} is out`,
  body: mix.genre ? `A new ${mix.genre} mix from O:K. Tap to listen.` : 'A new mix from O:K. Tap to listen.',
  data: { mix: mix.number } satisfies NewMixPayload,
  collapseId: `mix-${mix.number}`
});

export interface NotifyContext {
  soundcloud: SoundCloud;
  /** The SoundCloud store, where the playlist is cached for /api/stream */
  soundcloudStore: TokenStore;
  store: PushStore;
  apns: APNs;
  /** Clears /api/mixes from the CDN, so a tapped notification finds the new mix */
  purgeMixes: () => Promise<void>;
}

/**
 * Announces mixes added to the playlist since the last run. The first run only records
 * the newest mix. If Apple can't be reached at all, nothing is recorded, so the next run
 * tries again; the collapse id stops a device showing a mix twice.
 */
export const notifyNewMixes = async ({ soundcloud, soundcloudStore, store, apns, purgeMixes }: NotifyContext) => {
  const mixes = await fetchAndStoreMixes(soundcloud, soundcloudStore);
  const latest = mixes.reduce<Mix | null>((newest, mix) => (!newest || mix.number > newest.number ? mix : newest), null);
  if (!latest) return { announced: [], sent: 0, removed: 0, unreachable: false };

  const seen = (await store.get(LAST_SEEN, { type: 'json' })) as LastSeen | null;
  const record = () => store.setJSON(LAST_SEEN, { id: latest.id, number: latest.number } satisfies LastSeen);
  const fresh = seen
    ? mixes
        .filter(mix => mix.number > seen.number)
        .sort((a, b) => a.number - b.number)
        .slice(-MAX_PER_RUN)
    : [];
  if (!fresh.length) {
    if (seen?.id !== latest.id || seen.number !== latest.number) await record();
    return { announced: [], sent: 0, removed: 0, unreachable: false };
  }

  try {
    await purgeMixes();
  } catch (error) {
    console.error('Purging /api/mixes failed', error);
  }

  let tokens = (await store.list({ prefix: DEVICES })).blobs.map(blob => blob.key.slice(DEVICES.length));
  let sent = 0;
  let removed = 0;
  let unreachable = false;
  for (const mix of fresh) {
    const results = await apns.sendAll(tokens, notificationFor(mix));
    sent += results.filter(r => r.outcome === 'sent').length;
    const invalid = new Set(results.filter(r => r.outcome === 'invalid').map(r => r.token));
    await Promise.all([...invalid].map(token => store.delete(deviceKey(token))));
    removed += invalid.size;
    tokens = tokens.filter(token => !invalid.has(token));
    for (const result of results) {
      if (result.outcome === 'retry' || result.outcome === 'failed') {
        console.warn(`Push for #${mix.number} ${result.outcome}: ${result.reason}`);
      }
    }
    unreachable ||= results.length > 0 && results.every(r => r.outcome === 'retry');
  }
  if (!unreachable) await record();
  return { announced: fresh.map(mix => mix.number), sent, removed, unreachable };
};
