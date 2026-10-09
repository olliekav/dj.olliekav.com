import { describe, expect, it, vi } from 'vitest';
import { createR2Client, exists, IMMUTABLE, uploadOnce, type StorageClient, type UploadImpl } from '../storage.ts';

const client = (send: () => Promise<unknown>) => ({ send: vi.fn(send) }) as unknown as StorageClient;
const notFound = Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
const missing = () => client(async () => {
  throw notFound;
});

/** Captures the options each upload is constructed with. */
const fakeUpload = () => {
  const options: Array<ConstructorParameters<UploadImpl>[0]> = [];
  const done = vi.fn(async () => ({}));
  const Impl = class {
    constructor(opts: ConstructorParameters<UploadImpl>[0]) {
      options.push(opts);
    }
    done = done;
  };
  return { Impl: Impl as UploadImpl, options, done };
};

describe('createR2Client', () => {
  it('targets the account R2 endpoint', async () => {
    const r2 = createR2Client({ accountId: 'acct', accessKeyId: 'a', secretAccessKey: 'b' });
    const endpoint = await r2.config.endpoint!();
    expect(endpoint.hostname).toBe('acct.r2.cloudflarestorage.com');
  });
});

describe('exists', () => {
  it('is true when HEAD succeeds', async () => {
    expect(await exists(client(async () => ({})), 'b', 'k')).toBe(true);
  });

  it('is false on 404', async () => {
    expect(await exists(missing(), 'b', 'k')).toBe(false);
  });

  it('rethrows other errors', async () => {
    const denied = client(async () => {
      throw new Error('denied');
    });
    await expect(exists(denied, 'b', 'k')).rejects.toThrow('denied');
  });
});

describe('uploadOnce', () => {
  it('skips existing keys', async () => {
    const upload = fakeUpload();
    const result = await uploadOnce(
      client(async () => ({})),
      { bucket: 'b', key: 'k', body: Buffer.from(''), contentType: 'x' },
      { UploadImpl: upload.Impl }
    );
    expect(result).toEqual({ key: 'k', uploaded: false });
    expect(upload.options).toHaveLength(0);
  });

  it('uploads files with immutable caching and a download filename', async () => {
    const upload = fakeUpload();
    const result = await uploadOnce(
      missing(),
      {
        bucket: 'b',
        key: 'mixes/x/audio.mp3',
        body: new URL(import.meta.url).pathname,
        contentType: 'audio/mpeg',
        filename: 'x.mp3',
        disposition: 'attachment'
      },
      { UploadImpl: upload.Impl }
    );
    expect(result).toEqual({ key: 'mixes/x/audio.mp3', uploaded: true });
    const params = upload.options[0]!.params;
    expect(params).toMatchObject({
      Bucket: 'b',
      Key: 'mixes/x/audio.mp3',
      ContentType: 'audio/mpeg',
      CacheControl: IMMUTABLE,
      ContentDisposition: 'attachment; filename="x.mp3"'
    });
    const body = params.Body as NodeJS.ReadableStream & { destroy(): void };
    expect(typeof body.pipe).toBe('function');
    body.destroy();
    expect(upload.done).toHaveBeenCalled();
  });

  it('uploads buffers as-is without a filename', async () => {
    const upload = fakeUpload();
    const body = Buffer.from('{}');
    await uploadOnce(missing(), { bucket: 'b', key: 'k', body, contentType: 'application/json' }, { UploadImpl: upload.Impl });
    const params = upload.options[0]!.params;
    expect(params.Body).toBe(body);
    expect(params).not.toHaveProperty('ContentDisposition');
  });
});
