import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import type { PoolClient } from 'pg';
import { z } from 'zod';

import { hashPassword } from './auth';
import { closeDb, ensureSchema, withTransaction } from './db';

const realFoodReviewSchema = z.object({
  id: z.string().trim().min(1).max(120).refine((id) => id !== 'primary', 'Review id "primary" is reserved'),
  author: z.string().trim().min(1).max(80),
  yes: z.boolean(),
  text: z.string().max(4_000),
  pricePaid: z.number().finite().nonnegative().nullable().optional(),
  visitedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const ratingBaselineSchema = z.object({
  yesCount: z.number().int().nonnegative(),
  noCount: z.number().int().nonnegative(),
});

const realFoodRecordSchema = z.object({
  id: z.string().min(1),
  canonicalDishId: z.string().min(1),
  canonicalDishName: z.string().min(1),
  name: z.string().min(1),
  tags: z.array(z.string().min(1)),
  price: z.number().finite().nonnegative(),
  author: z.string().min(1),
  category: z.string().min(1),
  cuisine: z.string().min(1),
  dishType: z.string().min(1),
  imageFile: z.string().min(1),
  restaurantImageFile: z.string().min(1),
  address: z.string().min(1),
  restaurant: z.string().min(1),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  recommendation: z.string(),
  phone: z.string().nullable(),
  hours: z.string(),
  area: z.string(),
  reviews: z.array(realFoodReviewSchema)
    .refine((reviews) => new Set(reviews.map((review) => review.id)).size === reviews.length, 'Review ids must be unique within a version')
    .optional(),
  ratingBaseline: ratingBaselineSchema.optional(),
});

const realFoodRecordsSchema = z.array(realFoodRecordSchema).min(1);
export type RealFoodRecord = z.infer<typeof realFoodRecordSchema>;

export type SeedSummary = {
  dishes: number;
  restaurants: number;
  versions: number;
  reviews: number;
  tags: number;
  media: number;
  users: number;
};

export type SeedOptions = {
  includeMedia?: boolean;
  includeUsers?: boolean;
};

/**
 * Seeds the checked-in real food records. It is safe to run repeatedly:
 * imported items are keyed by legacy_key and existing admin edits win.
 *
 * Media metadata is only inserted when includeMedia is true, or when the CLI
 * is run with SEED_UPLOAD_MEDIA=true. The matching files must already have
 * been uploaded to Cloudflare R2; this module intentionally contains no
 * storage client.
 */
export async function seedDatabase(options: SeedOptions = {}): Promise<SeedSummary> {
  await ensureSchema();
  const records = loadRealFoodRecords();
  const includeMedia = options.includeMedia ?? process.env.SEED_UPLOAD_MEDIA === 'true';
  const includeUsers = options.includeUsers ?? true;
  const objectPrefix = normalizeObjectPrefix(process.env.SEED_MEDIA_OBJECT_PREFIX ?? 'seed/food');

  return withTransaction(async (client) => {
    const dishIds = new Map<string, string>();
    const restaurantIds = new Map<string, string>();
    const versionIds = new Map<string, string>();
    const tagIds = new Map<string, string>();
    const mediaIds = new Map<string, string>();

    let reviewsSeeded = 0;

    for (const record of records) {
      if (!dishIds.has(record.canonicalDishId)) {
        dishIds.set(record.canonicalDishId, await seedDish(client, record));
      }

      if (!restaurantIds.has(record.restaurant)) {
        restaurantIds.set(record.restaurant, await seedRestaurant(client, record));
      }

      const versionId = await seedVersion(
        client,
        record,
        requiredMapValue(dishIds, record.canonicalDishId),
        requiredMapValue(restaurantIds, record.restaurant),
      );
      versionIds.set(record.id, versionId);
      await seedDishAlias(client, requiredMapValue(dishIds, record.canonicalDishId), record);

      for (const tagName of record.tags) {
        let tagId = tagIds.get(tagName);
        if (!tagId) {
          tagId = await seedTag(client, tagName);
          tagIds.set(tagName, tagId);
        }
        await client.query(
          `
            INSERT INTO dish_version_tags (version_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `,
          [versionId, tagId],
        );
      }

      const reviews = reviewsForRecord(record);
      for (const review of reviews) {
        await seedReview(client, record, review, versionId);
        reviewsSeeded += 1;
      }
      await seedRatingBaseline(client, versionId, ratingBaselineForRecord(record));

      if (includeMedia) {
        const mediaId = await seedMedia(client, record, objectPrefix);
        mediaIds.set(record.id, mediaId);
        await client.query(
          `
            INSERT INTO version_media (version_id, media_id, sort_order, is_cover)
            VALUES ($1, $2, 0, false)
            ON CONFLICT DO NOTHING
          `,
          [versionId, mediaId],
        );
        await client.query(
          `
            UPDATE version_media seed_link
            SET is_cover = true
            WHERE seed_link.version_id = $1
              AND seed_link.media_id = $2
              AND NOT EXISTS (
                SELECT 1 FROM version_media current_cover
                WHERE current_cover.version_id = $1
                  AND current_cover.is_cover
                  AND current_cover.media_id <> $2
              )
          `,
          [versionId, mediaId],
        );
      }
    }

    let usersSeeded = 0;
    if (includeUsers) {
      const adminUserId = await seedEnvironmentUser(client, {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        displayName: process.env.ADMIN_DISPLAY_NAME ?? 'Dish Admin',
        role: 'admin',
        campus: null,
      });
      if (adminUserId) usersSeeded += 1;

      const demoUserId = await seedEnvironmentUser(client, {
        email: process.env.DEMO_USER_EMAIL,
        password: process.env.DEMO_USER_PASSWORD,
        displayName: process.env.DEMO_USER_DISPLAY_NAME ?? 'Mei Chen',
        role: 'user',
        campus: process.env.DEMO_USER_CAMPUS ?? 'USYD',
      });
      if (demoUserId) {
        usersSeeded += 1;
        await seedDemoSaves(client, demoUserId, dishIds, versionIds);
      }
    }

    return {
      dishes: dishIds.size,
      restaurants: restaurantIds.size,
      versions: versionIds.size,
      reviews: reviewsSeeded,
      tags: tagIds.size,
      media: mediaIds.size,
      users: usersSeeded,
    };
  });
}

async function seedDish(client: PoolClient, record: RealFoodRecord): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO dishes (
        legacy_key, slug, canonical_name, cuisine, dish_type,
        status, source, published_at
      )
      VALUES ($1, $2, $3, $4, $5, 'published', 'real_import', now())
      ON CONFLICT (legacy_key) DO UPDATE SET
        legacy_key = EXCLUDED.legacy_key,
        canonical_name = CASE
          WHEN dishes.source = 'real_import' THEN EXCLUDED.canonical_name
          ELSE dishes.canonical_name
        END,
        cuisine = CASE
          WHEN dishes.source = 'real_import'
            AND dishes.cuisine = $6
            AND dishes.dish_type = $6
          THEN EXCLUDED.cuisine
          ELSE dishes.cuisine
        END,
        dish_type = CASE
          WHEN dishes.source = 'real_import'
            AND dishes.cuisine = $6
            AND dishes.dish_type = $6
          THEN EXCLUDED.dish_type
          ELSE dishes.dish_type
        END
      RETURNING id
    `,
    [
      record.canonicalDishId,
      slugify(record.canonicalDishId.replace(/^real-/, '')),
      record.canonicalDishName,
      record.cuisine,
      record.dishType,
      record.category,
    ],
  );
  return requiredRowId(result.rows[0], 'dish', record.canonicalDishId);
}

async function seedDishAlias(
  client: PoolClient,
  dishId: string,
  record: RealFoodRecord,
): Promise<void> {
  const alias = record.name.trim();
  if (!alias || alias.localeCompare(record.canonicalDishName, undefined, { sensitivity: 'accent' }) === 0) return;
  await client.query(
    `
      INSERT INTO dish_aliases (dish_id, alias)
      VALUES ($1, $2)
      ON CONFLICT (dish_id, alias) DO NOTHING
    `,
    [dishId, alias],
  );
}

async function seedRestaurant(client: PoolClient, record: RealFoodRecord): Promise<string> {
  const slug = slugify(record.restaurant);
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO restaurants (
        legacy_key, slug, name, address, suburb, state, country_code,
        phone, latitude, longitude, timezone, hours_text, status, source, published_at
      )
      VALUES ($1, $2, $3, $4, $5, 'NSW', 'AU', $6, $7, $8, 'Australia/Sydney', $9,
        'published', 'real_import', now())
      ON CONFLICT (legacy_key) DO UPDATE SET
        legacy_key = EXCLUDED.legacy_key,
        latitude = CASE
          WHEN restaurants.source = 'real_import'
            AND (restaurants.latitude IS NULL OR restaurants.longitude IS NULL)
          THEN EXCLUDED.latitude
          ELSE restaurants.latitude
        END,
        longitude = CASE
          WHEN restaurants.source = 'real_import'
            AND (restaurants.latitude IS NULL OR restaurants.longitude IS NULL)
          THEN EXCLUDED.longitude
          ELSE restaurants.longitude
        END
      RETURNING id
    `,
    [
      realRestaurantLegacyKey(record.restaurant),
      slug,
      record.restaurant,
      record.address,
      record.area,
      record.phone,
      record.latitude,
      record.longitude,
      record.hours,
    ],
  );
  return requiredRowId(result.rows[0], 'restaurant', record.restaurant);
}

export function realRestaurantLegacyKey(name: string): string {
  return `real-restaurant:${slugify(name)}`;
}

async function seedVersion(
  client: PoolClient,
  record: RealFoodRecord,
  dishId: string,
  restaurantId: string,
): Promise<string> {
  const legacyKey = `${record.id}-v1`;
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO dish_versions (
        legacy_key, dish_id, restaurant_id, menu_name, listed_price,
        currency, status, source, published_at
      )
      VALUES ($1, $2, $3, $4, $5, 'AUD', 'published', 'real_import', now())
      ON CONFLICT (legacy_key) DO UPDATE SET
        legacy_key = EXCLUDED.legacy_key,
        menu_name = CASE
          WHEN dish_versions.source = 'real_import'
            AND dish_versions.menu_name = 'Str-fried Tender Beef with Pickled Chilies（泡椒牛肉）'
          THEN EXCLUDED.menu_name
          ELSE dish_versions.menu_name
        END
      RETURNING id
    `,
    [legacyKey, dishId, restaurantId, record.name, record.price],
  );
  return requiredRowId(result.rows[0], 'version', legacyKey);
}

async function seedTag(client: PoolClient, name: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO tags (slug, name)
      VALUES ($1, $2)
      ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
      RETURNING id
    `,
    [slugify(name), name],
  );
  return requiredRowId(result.rows[0], 'tag', name);
}

async function seedReview(
  client: PoolClient,
  record: RealFoodRecord,
  review: SeedReview,
  versionId: string,
): Promise<void> {
  await client.query(
    `
      INSERT INTO reviews (
        legacy_key, version_id, user_id, author_name_snapshot,
        would_eat_again, body, price_paid, visited_on, status, source
      )
      VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, 'published', 'real_import')
      ON CONFLICT (legacy_key) DO UPDATE SET
        version_id = CASE WHEN reviews.source = 'real_import' THEN EXCLUDED.version_id ELSE reviews.version_id END,
        author_name_snapshot = CASE WHEN reviews.source = 'real_import' THEN EXCLUDED.author_name_snapshot ELSE reviews.author_name_snapshot END,
        would_eat_again = CASE WHEN reviews.source = 'real_import' THEN EXCLUDED.would_eat_again ELSE reviews.would_eat_again END,
        body = CASE WHEN reviews.source = 'real_import' THEN EXCLUDED.body ELSE reviews.body END,
        price_paid = CASE WHEN reviews.source = 'real_import' THEN EXCLUDED.price_paid ELSE reviews.price_paid END,
        visited_on = CASE WHEN reviews.source = 'real_import' THEN EXCLUDED.visited_on ELSE reviews.visited_on END,
        updated_at = CASE WHEN reviews.source = 'real_import' THEN now() ELSE reviews.updated_at END
    `,
    [
      review.id === 'primary' ? `real-review:${record.id}` : `real-review:${record.id}:${review.id}`,
      versionId,
      review.author,
      review.yes,
      review.text,
      review.pricePaid,
      review.visitedOn,
    ],
  );
}

type SeedReview = {
  id: string;
  author: string;
  yes: boolean;
  text: string;
  pricePaid: number | null;
  visitedOn: string | null;
};

const fallbackPositiveReviews = [
  'A really satisfying version of this dish. The flavours were balanced and I would order it again.',
  'Fresh, well seasoned and a generous serve. It held up well even after the trip home.',
  'Comforting and full of flavour without feeling too heavy. A dependable order here.',
] as const;

const fallbackNegativeReviews = [
  'The flavours were decent, but the portion felt small for the price.',
  'A little too salty for me on this visit, although the texture was good.',
  'It arrived quickly, but the dish was not quite as balanced as I expected.',
] as const;

function reviewsForRecord(record: RealFoodRecord): SeedReview[] {
  const seed = stableSeed(record.id);
  const primary: SeedReview = {
    id: 'primary',
    author: record.author,
    yes: true,
    text: record.recommendation,
    pricePaid: record.price,
    visitedOn: null,
  };
  const configured = (record.reviews ?? []).map((review) => ({
    id: review.id,
    author: review.author,
    yes: review.yes,
    text: review.text,
    pricePaid: review.pricePaid ?? null,
    visitedOn: review.visitedOn ?? null,
  }));
  if (configured.length > 0) return [primary, ...configured];

  return [
    primary,
    {
      id: 'community-positive',
      author: ['Mia', 'Daniel', 'Sophie'][seed % 3]!,
      yes: true,
      text: fallbackPositiveReviews[seed % fallbackPositiveReviews.length]!,
      pricePaid: record.price,
      visitedOn: null,
    },
    {
      id: 'community-negative',
      author: ['Jordan', 'Sam', 'Taylor'][(seed + 1) % 3]!,
      yes: false,
      text: fallbackNegativeReviews[(seed + 1) % fallbackNegativeReviews.length]!,
      pricePaid: record.price,
      visitedOn: null,
    },
  ];
}

function ratingBaselineForRecord(record: RealFoodRecord): { yesCount: number; noCount: number } {
  if (record.ratingBaseline) return record.ratingBaseline;
  const seed = stableSeed(record.id);
  return {
    yesCount: 10 + (seed % 24),
    noCount: 2 + (Math.floor(seed / 7) % 7),
  };
}

async function seedRatingBaseline(
  client: PoolClient,
  versionId: string,
  baseline: { yesCount: number; noCount: number },
): Promise<void> {
  await client.query(
    `
      INSERT INTO version_rating_baselines (version_id, yes_count, no_count, source)
      VALUES ($1, $2, $3, 'real_import')
      ON CONFLICT (version_id) DO UPDATE SET
        yes_count = CASE
          WHEN version_rating_baselines.source = 'real_import' THEN EXCLUDED.yes_count
          ELSE version_rating_baselines.yes_count
        END,
        no_count = CASE
          WHEN version_rating_baselines.source = 'real_import' THEN EXCLUDED.no_count
          ELSE version_rating_baselines.no_count
        END
    `,
    [versionId, baseline.yesCount, baseline.noCount],
  );
}

function stableSeed(value: string): number {
  let seed = 0;
  for (const character of value) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  return seed;
}

async function seedMedia(
  client: PoolClient,
  record: RealFoodRecord,
  objectPrefix: string,
): Promise<string> {
  const legacyKey = `real-media:${record.id}`;
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO media (
        legacy_key, object_key, owner_user_id, media_type, purpose,
        status, mime_type, original_filename, alt_text, source
      )
      VALUES ($1, $2, NULL, 'image', 'version', 'approved', 'image/jpeg', $3, $4, 'real_import')
      ON CONFLICT (legacy_key) DO UPDATE SET
        object_key = CASE WHEN media.source = 'real_import' THEN EXCLUDED.object_key ELSE media.object_key END,
        mime_type = CASE WHEN media.source = 'real_import' THEN EXCLUDED.mime_type ELSE media.mime_type END,
        original_filename = CASE WHEN media.source = 'real_import' THEN EXCLUDED.original_filename ELSE media.original_filename END,
        alt_text = CASE WHEN media.source = 'real_import' THEN EXCLUDED.alt_text ELSE media.alt_text END
      RETURNING id
    `,
    [
      legacyKey,
      `${objectPrefix}/${record.imageFile}`,
      record.imageFile,
      `${record.name} at ${record.restaurant}`,
    ],
  );
  return requiredRowId(result.rows[0], 'media', legacyKey);
}

async function seedEnvironmentUser(
  client: PoolClient,
  input: {
    email?: string;
    password?: string;
    displayName: string;
    role: 'user' | 'admin';
    campus: string | null;
  },
): Promise<string | null> {
  const email = input.email?.trim().toLowerCase();
  const password = input.password;
  if (!email && !password) return null;
  if (!email || !password) {
    const prefix = input.role === 'admin' ? 'ADMIN' : 'DEMO_USER';
    throw new Error(`${prefix}_EMAIL and ${prefix}_PASSWORD must be set together`);
  }
  if (password.length < 8) throw new Error(`${input.role} seed password must be at least 8 characters`);

  const passwordHash = await hashPassword(password);
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO users (email, password_hash, display_name, campus, role, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      ON CONFLICT (email) DO UPDATE
      SET role = CASE WHEN users.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END,
          status = 'active'
      RETURNING id
    `,
    [email, passwordHash, input.displayName, input.campus, input.role],
  );
  return requiredRowId(result.rows[0], 'user', email);
}

async function seedDemoSaves(
  client: PoolClient,
  userId: string,
  dishIds: Map<string, string>,
  versionIds: Map<string, string>,
): Promise<void> {
  for (const dishId of [...dishIds.values()].slice(0, 3)) {
    await client.query(
      'INSERT INTO saved_dishes (user_id, dish_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, dishId],
    );
  }
  for (const versionId of [...versionIds.values()].slice(0, 3)) {
    await client.query(
      'INSERT INTO saved_versions (user_id, version_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, versionId],
    );
  }
}

export function loadRealFoodRecords(): RealFoodRecord[] {
  const sourcePath = findRealDataPath();
  const source = readFileSync(sourcePath, 'utf8');
  const declaration = 'export const realFoodRecords = ';
  const start = source.indexOf(declaration);
  const suffix = '] as const satisfies readonly RealFoodRecord[];';
  const end = source.indexOf(suffix, start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not extract realFoodRecords from ${sourcePath}`);
  }

  const literalStart = start + declaration.length;
  const literal = source.slice(literalStart, end + 1);
  const parsed = vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1_000 });
  const records = realFoodRecordsSchema.parse(parsed);
  assertCanonicalDishMetadata(records);
  return records;
}

function assertCanonicalDishMetadata(records: RealFoodRecord[]): void {
  const metadata = new Map<string, string>();
  for (const record of records) {
    const signature = [record.canonicalDishName, record.cuisine, record.dishType].join('\u0000');
    const existing = metadata.get(record.canonicalDishId);
    if (existing && existing !== signature) {
      throw new Error(`Conflicting canonical dish metadata for ${record.canonicalDishId}`);
    }
    metadata.set(record.canonicalDishId, signature);
  }
}

function findRealDataPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src/data/realData.ts'),
    path.resolve(process.cwd(), '../src/data/realData.ts'),
    path.resolve(__dirname, '../../src/data/realData.ts'),
    path.resolve(__dirname, '../../../src/data/realData.ts'),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) throw new Error(`Could not locate src/data/realData.ts. Checked: ${candidates.join(', ')}`);
  return match;
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) throw new Error(`Cannot create a slug from ${JSON.stringify(value)}`);
  return slug;
}

function normalizeObjectPrefix(value: string): string {
  const normalized = value.replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.includes('..')) throw new Error('SEED_MEDIA_OBJECT_PREFIX is invalid');
  return normalized;
}

function requiredMapValue(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Seed relationship was not created for ${key}`);
  return value;
}

function requiredRowId(
  row: { id: string } | undefined,
  entity: string,
  key: string,
): string {
  if (!row?.id) throw new Error(`Failed to seed ${entity} ${key}`);
  return row.id;
}

if (require.main === module) {
  seedDatabase()
    .then((summary) => {
      console.log('[seed] complete', summary);
    })
    .catch((error) => {
      console.error('[seed] failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeDb();
    });
}
