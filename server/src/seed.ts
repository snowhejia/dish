import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import type { PoolClient } from 'pg';
import { z } from 'zod';

import { hashPassword } from './auth';
import { closeDb, ensureSchema, withTransaction } from './db';

const realFoodRecordSchema = z.object({
  id: z.string().min(1),
  canonicalDishId: z.string().min(1),
  canonicalDishName: z.string().min(1),
  name: z.string().min(1),
  tags: z.array(z.string().min(1)),
  price: z.number().finite().nonnegative(),
  author: z.string().min(1),
  category: z.string().min(1),
  imageFile: z.string().min(1),
  address: z.string().min(1),
  restaurant: z.string().min(1),
  recommendation: z.string(),
  phone: z.string().nullable(),
  hours: z.string(),
  area: z.string(),
});

const realFoodRecordsSchema = z.array(realFoodRecordSchema).min(1);
type RealFoodRecord = z.infer<typeof realFoodRecordSchema>;

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
  const objectPrefix = normalizeObjectPrefix(process.env.SEED_MEDIA_OBJECT_PREFIX ?? 'seed/food');

  return withTransaction(async (client) => {
    const dishIds = new Map<string, string>();
    const restaurantIds = new Map<string, string>();
    const versionIds = new Map<string, string>();
    const tagIds = new Map<string, string>();
    const mediaIds = new Map<string, string>();

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

      await seedReview(client, record, versionId);

      if (includeMedia) {
        const mediaId = await seedMedia(client, record, objectPrefix);
        mediaIds.set(record.id, mediaId);
        await client.query(
          `
            INSERT INTO version_media (version_id, media_id, sort_order, is_cover)
            VALUES ($1, $2, 0, true)
            ON CONFLICT DO NOTHING
          `,
          [versionId, mediaId],
        );
      }
    }

    let usersSeeded = 0;
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

    return {
      dishes: dishIds.size,
      restaurants: restaurantIds.size,
      versions: versionIds.size,
      reviews: records.length,
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
      VALUES ($1, $2, $3, $4, $4, 'published', 'real_import', now())
      ON CONFLICT (legacy_key) DO UPDATE SET legacy_key = EXCLUDED.legacy_key
      RETURNING id
    `,
    [
      record.canonicalDishId,
      slugify(record.canonicalDishId.replace(/^real-/, '')),
      record.canonicalDishName,
      record.category,
    ],
  );
  return requiredRowId(result.rows[0], 'dish', record.canonicalDishId);
}

async function seedRestaurant(client: PoolClient, record: RealFoodRecord): Promise<string> {
  const slug = slugify(record.restaurant);
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO restaurants (
        legacy_key, slug, name, address, suburb, state, country_code,
        phone, timezone, hours_text, status, source, published_at
      )
      VALUES ($1, $2, $3, $4, $5, 'NSW', 'AU', $6, 'Australia/Sydney', $7,
        'published', 'real_import', now())
      ON CONFLICT (legacy_key) DO UPDATE SET legacy_key = EXCLUDED.legacy_key
      RETURNING id
    `,
    [
      `real-restaurant:${slug}`,
      slug,
      record.restaurant,
      record.address,
      record.area,
      record.phone,
      record.hours,
    ],
  );
  return requiredRowId(result.rows[0], 'restaurant', record.restaurant);
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
      ON CONFLICT (legacy_key) DO UPDATE SET legacy_key = EXCLUDED.legacy_key
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
  versionId: string,
): Promise<void> {
  await client.query(
    `
      INSERT INTO reviews (
        legacy_key, version_id, user_id, author_name_snapshot,
        would_eat_again, body, price_paid, status, source
      )
      VALUES ($1, $2, NULL, $3, true, $4, $5, 'published', 'real_import')
      ON CONFLICT (legacy_key) DO NOTHING
    `,
    [`real-review:${record.id}`, versionId, record.author, record.recommendation, record.price],
  );
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
      ON CONFLICT (legacy_key) DO UPDATE SET legacy_key = EXCLUDED.legacy_key
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

function loadRealFoodRecords(): RealFoodRecord[] {
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
  return realFoodRecordsSchema.parse(parsed);
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
