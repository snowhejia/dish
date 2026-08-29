import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { closeDb } from './db';
import { seedDatabase } from './seed';
import { isStorageConfigured, putImageObject } from './storage';

export async function uploadBundledSeedMedia() {
  if (!isStorageConfigured()) throw new Error('Cloudflare R2 variables must be configured before uploading seed media');
  const directory = findFoodDirectory();
  const prefix = (process.env.SEED_MEDIA_OBJECT_PREFIX ?? 'seed/food').replace(/^\/+|\/+$/g, '');
  const files = readdirSync(directory).filter((name) => /\.(jpe?g|png|webp)$/i.test(name));

  for (let index = 0; index < files.length; index += 4) {
    await Promise.all(files.slice(index, index + 4).map(async (name) => {
      const extension = path.extname(name).toLowerCase();
      const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
      await putImageObject(`${prefix}/${name}`, readFileSync(path.join(directory, name)), mime, name);
    }));
  }
  return { uploaded: files.length, prefix };
}

function findFoodDirectory() {
  const candidates = [
    path.resolve(process.cwd(), 'assets/images/food/real'),
    path.resolve(process.cwd(), '../assets/images/food/real'),
    path.resolve(__dirname, '../../assets/images/food/real'),
    path.resolve(__dirname, '../../../assets/images/food/real'),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) throw new Error(`Could not locate bundled food photos. Checked: ${candidates.join(', ')}`);
  return match;
}

if (require.main === module) {
  uploadBundledSeedMedia()
    .then(async (result) => {
      console.log('[seed-media] uploaded', result);
      console.log('[seed-media] database', await seedDatabase({ includeMedia: true }));
    })
    .catch((error) => {
      console.error('[seed-media] failed', error);
      process.exitCode = 1;
    })
    .finally(async () => closeDb());
}
