import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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
  return Boolean(
    process.env.R2_ACCOUNT_ID
      && process.env.R2_ACCESS_KEY_ID
      && process.env.R2_SECRET_ACCESS_KEY
      && process.env.R2_BUCKET
      && process.env.R2_PUBLIC_URL,
  );
}

export async function uploadImage(
  file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
  folder: 'versions' | 'reviews' | 'contributions' = 'versions',
): Promise<StoredObject> {
  const extension = allowedMimeTypes.get(file.mimetype);
  if (!extension) throw new Error('Only JPEG, PNG, WebP, HEIC and HEIF images are supported');
  if (!file.buffer.length || file.size > 10 * 1024 * 1024) throw new Error('Image must be between 1 byte and 10 MB');

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

export async function deleteImage(key: string) {
  if (!key || key.includes('..') || key.startsWith('/')) throw new Error('Invalid object key');
  await r2Client().send(new DeleteObjectCommand({ Bucket: required('R2_BUCKET'), Key: key }));
}
