import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { closeDb, ensureSchema, pool, query } from './db';
import { loadRealFoodRecords, seedDatabase } from './seed';
import { imageObjectExists, isStorageConfigured, putImageObject } from './storage';

type RealDataState = {
  imported: number;
  exactMediaLinks: number;
  visibleMediaLinks: number;
  legacyTaxonomy: number;
  taxonomyMismatches: number;
};

export async function uploadBundledSeedMedia(fileNames?: Iterable<string>) {
  if (!isStorageConfigured()) throw new Error('Cloudflare R2 variables must be configured before uploading seed media');
  const directory = findFoodDirectory();
  const prefix = normalizePrefix(process.env.SEED_MEDIA_OBJECT_PREFIX ?? 'seed/food');
  const expectedFiles = new Set(loadRealFoodRecords().map((record) => record.imageFile));
  const files = fileNames ? [...new Set(fileNames)] : [...expectedFiles];
  const unexpected = files.find((name) => !expectedFiles.has(name));
  if (unexpected) throw new Error(`Unrecognized seed photo: ${unexpected}`);

  for (let index = 0; index < files.length; index += 4) {
    await Promise.all(files.slice(index, index + 4).map(async (name) => {
      const filePath = path.join(directory, name);
      if (!existsSync(filePath)) throw new Error(`Bundled seed photo is missing: ${name}`);
      const extension = path.extname(name).toLowerCase();
      const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
      await putImageObject(`${prefix}/${name}`, readFileSync(filePath), mime, name);
    }));
  }
  return { uploaded: files.length, prefix };
}

/**
 * Repairs the checked-in real catalog without touching administrator or demo
 * accounts. A completed catalog is a cheap no-op on subsequent starts.
 */
export async function repairBundledRealData() {
  await ensureSchema();
  const lock = await pool.connect();
  try {
    await lock.query("SELECT pg_advisory_lock(hashtext('dish-real-data-repair-v1'))");
    return await repairBundledRealDataWithLock();
  } finally {
    try {
      await lock.query("SELECT pg_advisory_unlock(hashtext('dish-real-data-repair-v1'))");
    } finally {
      lock.release();
    }
  }
}

async function repairBundledRealDataWithLock() {
  const records = loadRealFoodRecords();
  const prefix = normalizePrefix(process.env.SEED_MEDIA_OBJECT_PREFIX ?? 'seed/food');
  const before = await realDataState(records, prefix);

  if (before.imported === 0) {
    return { status: 'skipped_no_imported_versions', expected: records.length, ...before };
  }
  if (before.imported !== records.length) {
    return { status: 'skipped_incomplete_import', expected: records.length, ...before };
  }
  const metadata = before.legacyTaxonomy > 0
    ? await seedDatabase({ includeMedia: false, includeUsers: false })
    : undefined;
  const current = metadata ? await realDataState(records, prefix) : before;
  const storageConfigured = isStorageConfigured();
  const missingObjects = storageConfigured
    ? await findMissingObjects(records, prefix)
    : undefined;

  if (current.exactMediaLinks === records.length && missingObjects?.length === 0) {
    const status = current.visibleMediaLinks === records.length
      ? 'already_complete'
      : 'complete_with_hidden_media';
    return {
      status,
      expected: records.length,
      before,
      current,
      metadata,
      storageVerified: true,
      missingObjects: [],
    };
  }
  if (!storageConfigured) {
    const status = current.exactMediaLinks === records.length
      ? 'complete_storage_unverified'
      : 'skipped_storage_not_configured';
    return {
      status,
      expected: records.length,
      before,
      current,
      metadata,
      storageVerified: false,
    };
  }

  const upload = await uploadBundledSeedMedia(missingObjects);
  const database = current.exactMediaLinks === records.length
    ? undefined
    : await seedDatabase({ includeMedia: true, includeUsers: false });
  const after = await realDataState(records, prefix);
  if (after.exactMediaLinks !== records.length) {
    throw new Error(`Real media repair linked ${after.exactMediaLinks} of ${records.length} expected photos`);
  }
  const stillMissingObjects = await findMissingObjects(records, prefix);
  if (stillMissingObjects.length > 0) {
    throw new Error(`Real media repair left ${stillMissingObjects.length} of ${records.length} photos missing from storage`);
  }
  const status = current.exactMediaLinks === records.length
    ? 'repaired_storage_objects'
    : 'repaired';
  return {
    status,
    expected: records.length,
    before,
    after,
    upload,
    database,
    metadata,
    storageVerified: true,
    missingObjects,
  };
}

async function realDataState(
  records: ReturnType<typeof loadRealFoodRecords>,
  prefix: string,
): Promise<RealDataState> {
  const dishMetadata = new Map<string, { cuisine: string; dishType: string; category: string }>();
  records.forEach((record) => dishMetadata.set(record.canonicalDishId, {
    cuisine: record.cuisine,
    dishType: record.dishType,
    category: record.category,
  }));
  const dishes = [...dishMetadata.entries()];
  const result = await query<{
    imported: string;
    exact_media_links: string;
    visible_media_links: string;
    legacy_taxonomy: string;
    taxonomy_mismatches: string;
  }>(
    `
      WITH expected_versions(version_key, media_key, object_key) AS (
        SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
      ), expected_dishes(dish_key, cuisine, dish_type, legacy_category) AS (
        SELECT * FROM unnest($4::text[], $5::text[], $6::text[], $7::text[])
      )
      SELECT
        (SELECT count(*) FROM expected_versions expected
          JOIN dish_versions version ON version.legacy_key = expected.version_key)::text AS imported,
        (SELECT count(*) FROM expected_versions expected
          JOIN dish_versions version ON version.legacy_key = expected.version_key
          JOIN version_media link ON link.version_id = version.id
          JOIN media photo ON photo.id = link.media_id
            AND photo.legacy_key = expected.media_key
            AND photo.object_key = expected.object_key)::text AS exact_media_links,
        (SELECT count(*) FROM expected_versions expected
          JOIN dish_versions version ON version.legacy_key = expected.version_key
          JOIN version_media link ON link.version_id = version.id
          JOIN media photo ON photo.id = link.media_id
            AND photo.legacy_key = expected.media_key
            AND photo.object_key = expected.object_key
            AND photo.status = 'approved')::text AS visible_media_links,
        (SELECT count(*) FROM expected_dishes expected
          JOIN dishes dish ON dish.legacy_key = expected.dish_key
          WHERE dish.source = 'real_import'
            AND dish.cuisine = expected.legacy_category
            AND dish.dish_type = expected.legacy_category)::text AS legacy_taxonomy,
        (SELECT count(*) FROM expected_dishes expected
          JOIN dishes dish ON dish.legacy_key = expected.dish_key
          WHERE dish.cuisine IS DISTINCT FROM expected.cuisine
             OR dish.dish_type IS DISTINCT FROM expected.dish_type)::text AS taxonomy_mismatches
    `,
    [
      records.map((record) => `${record.id}-v1`),
      records.map((record) => `real-media:${record.id}`),
      records.map((record) => `${prefix}/${record.imageFile}`),
      dishes.map(([dishKey]) => dishKey),
      dishes.map(([, metadata]) => metadata.cuisine),
      dishes.map(([, metadata]) => metadata.dishType),
      dishes.map(([, metadata]) => metadata.category),
    ],
  );
  return {
    imported: Number.parseInt(result.rows[0]?.imported ?? '0', 10),
    exactMediaLinks: Number.parseInt(result.rows[0]?.exact_media_links ?? '0', 10),
    visibleMediaLinks: Number.parseInt(result.rows[0]?.visible_media_links ?? '0', 10),
    legacyTaxonomy: Number.parseInt(result.rows[0]?.legacy_taxonomy ?? '0', 10),
    taxonomyMismatches: Number.parseInt(result.rows[0]?.taxonomy_mismatches ?? '0', 10),
  };
}

async function findMissingObjects(
  records: ReturnType<typeof loadRealFoodRecords>,
  prefix: string,
): Promise<string[]> {
  const missing: string[] = [];
  for (let index = 0; index < records.length; index += 4) {
    const batch = records.slice(index, index + 4);
    const existence = await Promise.all(batch.map((record) => imageObjectExists(`${prefix}/${record.imageFile}`)));
    existence.forEach((exists, offset) => {
      if (!exists) missing.push(batch[offset]!.imageFile);
    });
  }
  return missing;
}

function normalizePrefix(value: string): string {
  const normalized = value.replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.includes('..')) throw new Error('SEED_MEDIA_OBJECT_PREFIX is invalid');
  return normalized;
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
  repairBundledRealData()
    .then((result) => console.log('[real-data-repair] complete', result))
    .catch((error) => {
      console.error('[real-data-repair] failed', error);
      process.exitCode = 1;
    })
    .finally(async () => closeDb());
}
