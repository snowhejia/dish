import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const allowedMimeTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/heic', 'heic'],
  ['image/heif', 'heif'],
]);

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Cloudflare R2 uploads`);
  return value;
};

const r2Client = () => new S3Client({
  region: 'auto',
  endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
  },
});

export type StoredObject = {
  key: string;
  url: string;
  mimeType: string;
  bytes: number;
};

export function isStorageConfigured() {
  return [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET',
    'R2_PUBLIC_URL',
  ].every((name) => Boolean(process.env[name]?.trim()));
}

export async function uploadImage(
  file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
  folder: 'versions' | 'reviews' | 'contributions' = 'versions',
): Promise<StoredObject> {
  if (!isStorageConfigured()) {
    throw Object.assign(new Error('Cloudflare R2 is not configured on the server.'), {
      status: 503,
      code: 'STORAGE_NOT_CONFIGURED',
    });
  }
  const extension = allowedMimeTypes.get(file.mimetype);
  if (!extension) {
    throw Object.assign(new Error('Only JPEG, PNG, WebP, HEIC and HEIF images are supported'), {
      status: 400,
      code: 'UNSUPPORTED_IMAGE_TYPE',
    });
  }
  if (!file.buffer.length || file.size > 10 * 1024 * 1024) {
    throw Object.assign(new Error('Image must be between 1 byte and 10 MB'), {
      status: 400,
      code: 'INVALID_IMAGE_SIZE',
    });
  }

  const month = new Date().toISOString().slice(0, 7);
  const key = `${folder}/${month}/${randomUUID()}.${extension}`;
  await putImageObject(key, file.buffer, file.mimetype, file.originalname);

  const publicBase = required('R2_PUBLIC_URL').replace(/\/$/, '');
  return { key, url: `${publicBase}/${key}`, mimeType: file.mimetype, bytes: file.size };
}

export async function putImageObject(
  key: string,
  buffer: Buffer,
  mimeType: string,
  originalName?: string,
) {
  if (!key || key.includes('..') || key.startsWith('/')) throw new Error('Invalid object key');
  if (!allowedMimeTypes.has(mimeType)) throw new Error(`Unsupported image type: ${mimeType}`);
  await r2Client().send(new PutObjectCommand({
    Bucket: required('R2_BUCKET'),
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: originalName ? { originalname: encodeURIComponent(originalName).slice(0, 900) } : undefined,
  }));
}

export async function imageObjectExists(key: string): Promise<boolean> {
  if (!key || key.includes('..') || key.startsWith('/')) throw new Error('Invalid object key');
  try {
    await r2Client().send(new HeadObjectCommand({ Bucket: required('R2_BUCKET'), Key: key }));
    return true;
  } catch (error) {
    const status = typeof error === 'object' && error !== null
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;
    if (status === 404) return false;
    throw error;
  }
}

export async function deleteImage(key: string) {
  if (!key || key.includes('..') || key.startsWith('/')) throw new Error('Invalid object key');
  await r2Client().send(new DeleteObjectCommand({ Bucket: required('R2_BUCKET'), Key: key }));
}
