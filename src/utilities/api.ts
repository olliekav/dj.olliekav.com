import type { Mix, MixList, Stream, Waveform } from '../../shared/api-types';

type Fetch = typeof fetch;

// Same origin on the website; the native apps use https://dj.olliekav.com
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const getJson = async <T>(url: string, fetchFn: Fetch): Promise<T> => {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return (await response.json()) as T;
};

export const fetchMixes = async (fetchFn: Fetch = fetch): Promise<Mix[]> =>
  (await getJson<MixList>(`${API_URL}/api/mixes`, fetchFn)).mixes;

/** A short-lived HLS URL for the mix; request it when playback starts. */
export const fetchStream = (mix: Pick<Mix, 'urn'>, fetchFn: Fetch = fetch): Promise<Stream> =>
  getJson<Stream>(`${API_URL}/api/stream?${new URLSearchParams({ urn: mix.urn })}`, fetchFn);

/** SoundCloud's waveform as one channel of 0–1 peaks, the shape wavesurfer expects. */
export const fetchPeaks = async (url: string | null, fetchFn: Fetch = fetch): Promise<number[][] | undefined> => {
  if (!url) {
    return undefined;
  }
  const { samples, height } = await getJson<Waveform>(url, fetchFn);
  return [samples.map(sample => sample / (height || 1))];
};
