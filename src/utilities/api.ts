import type { Mix, MixList, Peaks } from '../../shared/api-types';

type Fetch = typeof fetch;

export const API_URL = (import.meta.env.VITE_API_URL ?? 'https://api.olliekav.com').replace(/\/$/, '');

const DEVICE_KEY = 'ok-sessions-device-id';
let memoryDeviceId: string | null = null;

/** Anonymous per-browser id used only to de-duplicate play counts. */
export const getDeviceId = (storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): string => {
  try {
    let id = storage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      storage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    memoryDeviceId ??= crypto.randomUUID();
    return memoryDeviceId;
  }
};

export const fetchMixes = async (fetchFn: Fetch = fetch): Promise<Mix[]> => {
  const response = await fetchFn(`${API_URL}/v1/mixes`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const { mixes } = (await response.json()) as MixList;
  // The grid reads oldest to newest, numbered like the sessions
  return [...mixes].sort((a, b) => a.number - b.number);
};

const postEvent = async (path: string, body: object, fetchFn: Fetch = fetch): Promise<void> => {
  try {
    await fetchFn(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), platform: 'web', ...body }),
      keepalive: true
    });
  } catch {
    // Stats are best effort
  }
};

export const reportPlay = (slug: string, { completed = false } = {}, fetchFn?: Fetch) =>
  postEvent(`/v1/mixes/${slug}/plays`, completed ? { completed } : {}, fetchFn);

export const reportDownload = (slug: string, fetchFn?: Fetch) =>
  postEvent(`/v1/mixes/${slug}/downloads`, {}, fetchFn);

/** Fetches precomputed peaks in the shape wavesurfer expects (one channel). */
export const fetchPeaks = async (url: string | null, fetchFn: Fetch = fetch): Promise<number[][] | undefined> => {
  if (!url) {
    return undefined;
  }
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const { peaks } = (await response.json()) as Peaks;
  return [peaks];
};
