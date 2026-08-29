import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { closeDb, ensureSchema, pool, query } from './db';
import { loadRealFoodRecords, realRestaurantLegacyKey, seedDatabase } from './seed';
import { imageObjectExists, isStorageConfigured, putImageObject } from './storage';

type RealDataState = {
  imported: number;
  importedRestaurants: number;
  exactMediaLinks: number;
  visibleMediaLinks: number;
  legacyTaxonomy: number;
  taxonomyMismatches: number;
  canonicalNameMismatches: number;
  missingRestaurantCoordinates: number;
  versionRestaurantMismatches: number;
};

type RestaurantCoverState = {
  imported: number;
  seededCovers: number;
  preservedAdminCovers: number;
  missingCovers: number;
};

type RestaurantCoverExpectation = {
  legacyKey: string;
  fileName: string;
  objectKey: string;
};

const REAL_DATA_REVISION = 'catalog_seed_20260830_verified_sydney_v1';
const REAL_DATA_REVISION_CHECKSUM = 'verified-sydney-restaurants-and-current-menus-v1';

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

export async function uploadBundledRestaurantSeedMedia(fileNames?: Iterable<string>) {
  if (!isStorageConfigured()) throw new Error('Cloudflare R2 variables must be configured before uploading restaurant seed media');
  const directory = findRestaurantDirectory();
  const prefix = normalizePrefix(process.env.SEED_RESTAURANT_MEDIA_OBJECT_PREFIX ?? 'seed/restaurants');
  const expectedFiles = new Set(restaurantCoverExpectations(loadRealFoodRecords(), prefix).map((cover) => cover.fileName));
  const files = fileNames ? [...new Set(fileNames)] : [...expectedFiles];
  const unexpected = files.find((name) => !expectedFiles.has(name));
  if (unexpected) throw new Error(`Unrecognized restaurant seed photo: ${unexpected}`);

  for (let index = 0; index < files.length; index += 4) {
    await Promise.all(files.slice(index, index + 4).map(async (name) => {
      const filePath = path.join(directory, name);
      if (!existsSync(filePath)) throw new Error(`Bundled restaurant seed photo is missing: ${name}`);
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
  const expectedRestaurants = new Set(records.map((record) => realRestaurantLegacyKey(record.restaurant))).size;
  const before = await realDataState(records, prefix);
  const revisionApplied = await realDataRevisionApplied();

  // Converge metadata when this deploy adds checked-in records or repairs the
  // original import. Once complete, normal restarts stay read-only so an
  // administrator's later tag and alias choices are not reintroduced.
  const needsMetadata = !revisionApplied
    || before.imported !== records.length
    || before.importedRestaurants !== expectedRestaurants
    || before.legacyTaxonomy > 0
    || before.taxonomyMismatches > 0
    || before.canonicalNameMismatches > 0
    || before.missingRestaurantCoordinates > 0
    || before.versionRestaurantMismatches > 0;
  const metadata = needsMetadata
    ? await seedDatabase({ includeMedia: false, includeUsers: false })
    : undefined;
  const restaurantCovers = await repairBundledRestaurantCovers(records);
  const current = metadata ? await realDataState(records, prefix) : before;
  if (current.imported !== records.length) {
    throw new Error(`Real data repair imported ${current.imported} of ${records.length} expected versions`);
  }
  if (current.importedRestaurants !== expectedRestaurants) {
    throw new Error(`Real data repair imported ${current.importedRestaurants} of ${expectedRestaurants} expected restaurants`);
  }
  if (current.missingRestaurantCoordinates > 0) {
    throw new Error(`Real data repair left ${current.missingRestaurantCoordinates} imported restaurants without coordinates`);
  }
  if (current.versionRestaurantMismatches > 0) {
    throw new Error(`Real data repair left ${current.versionRestaurantMismatches} versions linked to the wrong restaurant`);
  }
  if (metadata && !revisionApplied) await markRealDataRevisionApplied();
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
      restaurantCovers,
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
      restaurantCovers,
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
    restaurantCovers,
    storageVerified: true,
    missingObjects,
  };
}

async function realDataRevisionApplied() {
  const result = await query<{ applied: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1) AS applied',
    [REAL_DATA_REVISION],
  );
  return result.rows[0]?.applied ?? false;
}

async function markRealDataRevisionApplied() {
  await query(
    `
      INSERT INTO schema_migrations (version, checksum, applied_at)
      VALUES ($1, $2, now())
      ON CONFLICT (version) DO NOTHING
    `,
    [REAL_DATA_REVISION, REAL_DATA_REVISION_CHECKSUM],
  );
}

async function repairBundledRestaurantCovers(
  records: ReturnType<typeof loadRealFoodRecords>,
) {
  const prefix = normalizePrefix(process.env.SEED_RESTAURANT_MEDIA_OBJECT_PREFIX ?? 'seed/restaurants');
  const expected = restaurantCoverExpectations(records, prefix);
  const before = await restaurantCoverState(expected);

  if (before.imported === 0) {
    return {
      status: 'skipped_no_imported_restaurants',
      expected: expected.length,
      before,
      storageVerified: false,
    };
  }
  if (before.imported !== expected.length) {
    return {
      status: 'skipped_incomplete_restaurant_import',
      expected: expected.length,
      before,
      storageVerified: false,
    };
  }
  if (!isStorageConfigured()) {
    return {
      status: before.missingCovers === 0 ? 'complete_storage_unverified' : 'skipped_storage_not_configured',
      expected: expected.length,
      before,
      storageVerified: false,
    };
  }

  const missingObjects = await findMissingRestaurantObjects(expected);
  const upload = missingObjects.length > 0
    ? await uploadBundledRestaurantSeedMedia(missingObjects)
    : undefined;
  const database = before.missingCovers > 0
    ? await linkMissingRestaurantCovers(expected)
    : undefined;
  const after = await restaurantCoverState(expected);
  if (after.imported !== expected.length || after.missingCovers !== 0) {
    throw new Error(`Restaurant cover repair linked ${after.seededCovers + after.preservedAdminCovers} of ${expected.length} expected restaurants`);
  }
  const stillMissingObjects = await findMissingRestaurantObjects(expected);
  if (stillMissingObjects.length > 0) {
    throw new Error(`Restaurant cover repair left ${stillMissingObjects.length} of ${expected.length} photos missing from storage`);
  }

  const changed = missingObjects.length > 0 || (database?.linked ?? 0) > 0;
  return {
    status: changed ? 'repaired' : 'already_complete',
    expected: expected.length,
    before,
    after,
    upload,
    database,
    storageVerified: true,
    missingObjects,
  };
}

async function restaurantCoverState(
  expected: RestaurantCoverExpectation[],
): Promise<RestaurantCoverState> {
  const result = await query<{
    imported: string;
    seeded_covers: string;
    preserved_admin_covers: string;
    missing_covers: string;
  }>(
    `
      WITH expected(legacy_key, object_key) AS (
        SELECT * FROM unnest($1::text[], $2::text[])
      )
      SELECT
        count(restaurant.id)::text AS imported,
        count(*) FILTER (WHERE restaurant.cover_object_key = expected.object_key)::text AS seeded_covers,
        count(*) FILTER (
          WHERE restaurant.cover_object_key IS NOT NULL
            AND restaurant.cover_object_key <> expected.object_key
        )::text AS preserved_admin_covers,
        count(*) FILTER (WHERE restaurant.cover_object_key IS NULL)::text AS missing_covers
      FROM expected
      LEFT JOIN restaurants restaurant
        ON restaurant.legacy_key = expected.legacy_key
       AND restaurant.source = 'real_import'
    `,
    [expected.map((cover) => cover.legacyKey), expected.map((cover) => cover.objectKey)],
  );
  return {
    imported: Number.parseInt(result.rows[0]?.imported ?? '0', 10),
    seededCovers: Number.parseInt(result.rows[0]?.seeded_covers ?? '0', 10),
    preservedAdminCovers: Number.parseInt(result.rows[0]?.preserved_admin_covers ?? '0', 10),
    missingCovers: Number.parseInt(result.rows[0]?.missing_covers ?? '0', 10),
  };
}

async function linkMissingRestaurantCovers(expected: RestaurantCoverExpectation[]) {
  const result = await query(
    `
      WITH expected(legacy_key, object_key) AS (
        SELECT * FROM unnest($1::text[], $2::text[])
      )
      UPDATE restaurants restaurant
      SET cover_object_key = expected.object_key
      FROM expected
      WHERE restaurant.legacy_key = expected.legacy_key
        AND restaurant.source = 'real_import'
        AND restaurant.cover_object_key IS NULL
    `,
    [expected.map((cover) => cover.legacyKey), expected.map((cover) => cover.objectKey)],
  );
  return { linked: result.rowCount ?? 0 };
}

function restaurantCoverExpectations(
  records: ReturnType<typeof loadRealFoodRecords>,
  prefix: string,
): RestaurantCoverExpectation[] {
  const filesByRestaurant = new Map<string, string>();
  records.forEach((record) => {
    const current = filesByRestaurant.get(record.restaurant);
    if (current && current !== record.restaurantImageFile) {
      throw new Error(`Restaurant ${record.restaurant} has conflicting cover photos: ${current} and ${record.restaurantImageFile}`);
    }
    filesByRestaurant.set(record.restaurant, record.restaurantImageFile);
  });
  return [...filesByRestaurant].map(([name, fileName]) => ({
    legacyKey: realRestaurantLegacyKey(name),
    fileName,
    objectKey: `${prefix}/${fileName}`,
  }));
}

async function findMissingRestaurantObjects(
  expected: RestaurantCoverExpectation[],
): Promise<string[]> {
  const missing: string[] = [];
  for (let index = 0; index < expected.length; index += 4) {
    const batch = expected.slice(index, index + 4);
    const existence = await Promise.all(batch.map((cover) => imageObjectExists(cover.objectKey)));
    existence.forEach((exists, offset) => {
      if (!exists) missing.push(batch[offset]!.fileName);
    });
  }
  return missing;
}

async function realDataState(
  records: ReturnType<typeof loadRealFoodRecords>,
  prefix: string,
): Promise<RealDataState> {
  const dishMetadata = new Map<string, {
    canonicalName: string;
    cuisine: string;
    dishType: string;
    category: string;
  }>();
  records.forEach((record) => dishMetadata.set(record.canonicalDishId, {
    canonicalName: record.canonicalDishName,
    cuisine: record.cuisine,
    dishType: record.dishType,
    category: record.category,
  }));
  const dishes = [...dishMetadata.entries()];
  const restaurantKeys = [...new Set(records.map((record) => realRestaurantLegacyKey(record.restaurant)))];
  const result = await query<{
    imported: string;
    imported_restaurants: string;
    exact_media_links: string;
    visible_media_links: string;
    legacy_taxonomy: string;
    taxonomy_mismatches: string;
    canonical_name_mismatches: string;
    missing_restaurant_coordinates: string;
    version_restaurant_mismatches: string;
  }>(
    `
      WITH expected_versions(version_key, media_key, object_key) AS (
        SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
      ), expected_dishes(dish_key, canonical_name, cuisine, dish_type, legacy_category) AS (
        SELECT * FROM unnest($4::text[], $5::text[], $6::text[], $7::text[], $8::text[])
      ), expected_restaurants(restaurant_key) AS (
        SELECT * FROM unnest($9::text[])
      ), expected_version_restaurants(version_key, restaurant_key) AS (
        SELECT * FROM unnest($1::text[], $10::text[])
      )
      SELECT
        (SELECT count(*) FROM expected_versions expected
          JOIN dish_versions version ON version.legacy_key = expected.version_key)::text AS imported,
        (SELECT count(*) FROM expected_restaurants expected
          JOIN restaurants restaurant ON restaurant.legacy_key = expected.restaurant_key)::text AS imported_restaurants,
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
          WHERE dish.source = 'real_import'
            AND (dish.cuisine IS DISTINCT FROM expected.cuisine
              OR dish.dish_type IS DISTINCT FROM expected.dish_type))::text AS taxonomy_mismatches,
        (SELECT count(*) FROM expected_dishes expected
          JOIN dishes dish ON dish.legacy_key = expected.dish_key
          WHERE dish.source = 'real_import'
            AND dish.canonical_name IS DISTINCT FROM expected.canonical_name)::text AS canonical_name_mismatches,
        (SELECT count(*) FROM expected_restaurants expected
          LEFT JOIN restaurants restaurant ON restaurant.legacy_key = expected.restaurant_key
          WHERE restaurant.id IS NULL
            OR restaurant.source <> 'real_import'
            OR restaurant.latitude IS NULL
            OR restaurant.longitude IS NULL)::text AS missing_restaurant_coordinates,
        (SELECT count(*) FROM expected_version_restaurants expected
          LEFT JOIN dish_versions version ON version.legacy_key = expected.version_key
          LEFT JOIN restaurants restaurant ON restaurant.id = version.restaurant_id
          WHERE restaurant.legacy_key IS DISTINCT FROM expected.restaurant_key)::text AS version_restaurant_mismatches
    `,
    [
      records.map((record) => `${record.id}-v1`),
      records.map((record) => `real-media:${record.id}`),
      records.map((record) => `${prefix}/${record.imageFile}`),
      dishes.map(([dishKey]) => dishKey),
      dishes.map(([, metadata]) => metadata.canonicalName),
      dishes.map(([, metadata]) => metadata.cuisine),
      dishes.map(([, metadata]) => metadata.dishType),
      dishes.map(([, metadata]) => metadata.category),
      restaurantKeys,
      records.map((record) => realRestaurantLegacyKey(record.restaurant)),
    ],
  );
  return {
    imported: Number.parseInt(result.rows[0]?.imported ?? '0', 10),
    importedRestaurants: Number.parseInt(result.rows[0]?.imported_restaurants ?? '0', 10),
    exactMediaLinks: Number.parseInt(result.rows[0]?.exact_media_links ?? '0', 10),
    visibleMediaLinks: Number.parseInt(result.rows[0]?.visible_media_links ?? '0', 10),
    legacyTaxonomy: Number.parseInt(result.rows[0]?.legacy_taxonomy ?? '0', 10),
    taxonomyMismatches: Number.parseInt(result.rows[0]?.taxonomy_mismatches ?? '0', 10),
    canonicalNameMismatches: Number.parseInt(result.rows[0]?.canonical_name_mismatches ?? '0', 10),
    missingRestaurantCoordinates: Number.parseInt(result.rows[0]?.missing_restaurant_coordinates ?? '0', 10),
    versionRestaurantMismatches: Number.parseInt(result.rows[0]?.version_restaurant_mismatches ?? '0', 10),
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

function findRestaurantDirectory() {
  const candidates = [
    path.resolve(process.cwd(), 'assets/images/restaurants/real'),
    path.resolve(process.cwd(), '../assets/images/restaurants/real'),
    path.resolve(__dirname, '../../assets/images/restaurants/real'),
    path.resolve(__dirname, '../../../assets/images/restaurants/real'),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) throw new Error(`Could not locate bundled restaurant photos. Checked: ${candidates.join(', ')}`);
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
