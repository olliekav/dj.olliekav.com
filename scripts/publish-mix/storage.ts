import { createReadStream } from 'node:fs';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// Keys contain a content hash, so objects never change and can be cached forever
export const IMMUTABLE = 'public, max-age=31536000, immutable';

export type StorageClient = Pick<S3Client, 'send'>;

export const createR2Client = ({
  accountId,
  accessKeyId,
  secretAccessKey
}: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}) =>
  new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });

export const exists = async (client: StorageClient, bucket: string, key: string): Promise<boolean> => {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};

export interface UploadItem {
  bucket: string;
  key: string;
  /** A file path, or the bytes to upload */
  body: string | Buffer;
  contentType: string;
  filename?: string;
  disposition?: 'inline' | 'attachment';
}

export interface UploadResult {
  key: string;
  uploaded: boolean;
}

type UploadOptions = ConstructorParameters<typeof Upload>[0];
export type UploadImpl = new (options: UploadOptions) => { done(): Promise<unknown> };

/** Uploads a file or buffer unless the (content-addressed) key already exists. */
export const uploadOnce = async (
  client: StorageClient,
  { bucket, key, body, contentType, filename, disposition = 'inline' }: UploadItem,
  { UploadImpl = Upload as UploadImpl }: { UploadImpl?: UploadImpl } = {}
): Promise<UploadResult> => {
  if (await exists(client, bucket, key)) {
    return { key, uploaded: false };
  }
  const upload = new UploadImpl({
    client: client as S3Client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: typeof body === 'string' ? createReadStream(body) : body,
      ContentType: contentType,
      CacheControl: IMMUTABLE,
      ...(filename ? { ContentDisposition: `${disposition}; filename="${filename}"` } : {})
    },
    queueSize: 4,
    partSize: 16 * 1024 * 1024
  });
  await upload.done();
  return { key, uploaded: true };
};
