import type { Mix } from '../../shared/api-types.ts';

export interface MixInput {
  number: number;
  title: string;
  description: string;
  genre: string | null;
  recorded_at: string | null;
  published_at: string | null;
  duration_ms: number;
  audio_m4a_key: string;
  audio_mp3_key: string | null;
  peaks_key: string | null;
  artwork_key: string | null;
  theme: Mix['theme'];
  soundcloud_url: string | null;
  status: 'draft' | 'published';
  access: Mix['access'];
}

export type AdminMix = Mix & { status: MixInput['status'] };

export interface Api {
  putMix(slug: string, input: MixInput): Promise<AdminMix>;
  listMixes(): Promise<AdminMix[]>;
}

export const createApi = ({
  baseUrl,
  adminToken,
  accessClientId,
  accessClientSecret,
  fetchFn = fetch
}: {
  baseUrl: string;
  adminToken: string;
  accessClientId?: string;
  accessClientSecret?: string;
  fetchFn?: typeof fetch;
}): Api => {
  const headers: Record<string, string> = {
    authorization: `Bearer ${adminToken}`,
    'content-type': 'application/json',
    // Cloudflare Access service token, when /v1/admin is behind Access
    ...(accessClientId && accessClientSecret
      ? { 'CF-Access-Client-Id': accessClientId, 'CF-Access-Client-Secret': accessClientSecret }
      : {})
  };

  const url = (path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;

  const parse = async <T>(res: Response): Promise<T> => {
    const body = (await res.json().catch(() => ({}))) as T & { error?: string; issues?: unknown };
    if (!res.ok) {
      const issues = body.issues ? `\n${JSON.stringify(body.issues, null, 2)}` : '';
      throw new Error(`API ${res.status}: ${body.error ?? res.statusText}${issues}`);
    }
    return body;
  };

  return {
    async listMixes() {
      const { mixes } = await parse<{ mixes: AdminMix[] }>(await fetchFn(url('/v1/admin/mixes'), { headers }));
      return mixes;
    },

    async putMix(slug, input) {
      const res = await fetchFn(url(`/v1/admin/mixes/${slug}`), {
        method: 'PUT',
        headers,
        body: JSON.stringify(input)
      });
      return (await parse<{ mix: AdminMix }>(res)).mix;
    }
  };
};
