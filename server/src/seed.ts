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

type CuratedRestaurantCorrection = {
  expected: {
    name: string;
    address: string;
    area: string;
    phone: string | null;
    latitude: number;
    longitude: number;
    hours: string;
  };
  next: {
    name: string;
    address: string;
    area: string;
    phone: string | null;
    latitude: number;
    longitude: number;
    hours: string;
  };
};

type CuratedVersionCorrection = {
  legacyKey: string;
  expectedMenuName: string;
  expectedPrice: number;
  menuName: string;
  price: number;
};

const curatedRestaurantCorrections: CuratedRestaurantCorrection[] = [
  {
    expected: {
      name: 'KOKORO TOKYO MAZESOBA – Sydney',
      address: '225 George St, The Rocks NSW 2000',
      area: 'The Rocks',
      phone: '+61 2 9749 7130',
      latitude: -33.8645,
      longitude: 151.2064,
      hours: 'Mon–Thu 11:30–14:30 / 17:00–21:00；Fri 11:30–14:30 / 17:00–22:00；Sat 11:30–22:00',
    },
    next: {
      name: 'KOKORO TOKYO MAZESOBA – Sydney',
      address: 'T03, 225 George Street North Forecourt, Grosvenor Place, Sydney NSW 2000',
      area: 'Sydney CBD',
      phone: '+61 468 328 661',
      latitude: -33.8645,
      longitude: 151.2064,
      hours: 'Mon–Thu 11:30–14:30 / 17:00–21:00; Fri–Sat 11:30–14:30 / 17:00–22:00; Sun Closed',
    },
  },
  {
    expected: {
      name: '1915 Lanzhou Beef Noodles',
      address: 'Shop 13, 11–13 Hay St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.8798,
      longitude: 151.2046,
      hours: 'Daily 11:00–21:30',
    },
    next: {
      name: '1915 Lanzhou Beef Noodles',
      address: 'Shop 1, 815–825 George St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.8828583,
      longitude: 151.2036874,
      hours: 'Daily 11:00–21:00',
    },
  },
  {
    expected: {
      name: 'Jinweide Beef Noodles',
      address: 'Shop 3, 743–755 George St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.8791,
      longitude: 151.2053,
      hours: 'Daily 10:30–21:30',
    },
    next: {
      name: 'Jinweide Lanzhou Beef Noodles',
      address: 'Shop 8, 258–264 Burwood Rd, Burwood NSW 2134',
      area: 'Burwood',
      phone: '(02) 9360 0171',
      latitude: -33.8804688,
      longitude: 151.1034623,
      hours: 'Daily 11:00–22:00',
    },
  },
  {
    expected: {
      name: 'Lin Lin Taiwanese Cuisine',
      address: 'Shop 7, 10 Dixon St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.8778,
      longitude: 151.2038,
      hours: 'Daily 11:00–21:00',
    },
    next: {
      name: "Mother Chu's Taiwanese Gourmet",
      address: 'Shop 1, 86–88 Dixon St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.8791409,
      longitude: 151.2042991,
      hours: 'Sun–Thu 09:00–20:00; Fri–Sat 09:00–20:30',
    },
  },
  {
    expected: {
      name: 'TW YES',
      address: 'Shop 11, 1 Dixon St, Sydney NSW 2000',
      area: 'Sydney CBD',
      phone: null,
      latitude: -33.8759,
      longitude: 151.2047,
      hours: 'Mon–Sat 11:30–21:00; Sun 11:30–20:30',
    },
    next: {
      name: 'Linla',
      address: '413 Bourke St, Surry Hills NSW 2010',
      area: 'Surry Hills',
      phone: '(02) 3820 5694',
      latitude: -33.88206145,
      longitude: 151.2162016,
      hours: 'Tue–Sat 17:30–01:00; Sun–Mon Closed',
    },
  },
  {
    expected: {
      name: 'Chinese Noodle Restaurant',
      address: 'Shop 7, 8 Quay St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.8835,
      longitude: 151.2018,
      hours: 'Daily 11:00–21:00',
    },
    next: {
      name: 'QG13 Chinatown Noodle Restaurant',
      address: 'QG13/8 Quay St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.8810376,
      longitude: 151.2031077,
      hours: 'Daily 10:00–15:00, 17:00–20:30',
    },
  },
  {
    expected: {
      name: 'Zhang Liang Malatang',
      address: 'Shop 10, 8–10 Dixon St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.8777,
      longitude: 151.2039,
      hours: 'Daily 11:00–23:00',
    },
    next: {
      name: 'Zhang Liang Malatang Haymarket',
      address: 'Shop 1B & 1C/718 George St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: '0448 888 106',
      latitude: -33.878664,
      longitude: 151.206036,
      hours: 'Daily 11:00–23:30',
    },
  },
  {
    expected: {
      name: 'Yang Guo Fu Malatang',
      address: '127 Burwood Rd, Burwood NSW 2134',
      area: 'Burwood',
      phone: null,
      latitude: -33.8766,
      longitude: 151.1039,
      hours: 'Daily 11:00–22:30',
    },
    next: {
      name: 'YangGuoFu Malatang Burwood',
      address: '45 Burwood Rd, Burwood NSW 2134',
      area: 'Burwood',
      phone: '0424 122 212',
      latitude: -33.8747896,
      longitude: 151.1039287,
      hours: 'Daily 10:30–23:30',
    },
  },
  {
    expected: {
      name: 'Kowloon Cafe',
      address: '84 Dixon St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.8793,
      longitude: 151.2037,
      hours: 'Daily 11:00–22:00',
    },
    next: {
      name: 'Kowloon Cafe',
      address: 'Shop 7A–9A/421–429 Sussex St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.8792724,
      longitude: 151.204449,
      hours: 'Daily 11:30–21:00',
    },
  },
  {
    expected: {
      name: 'DOPA Donburi and Milk Bar',
      address: 'Shop 5, 12–14 Steam Mill Lane, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.8795,
      longitude: 151.2019,
      hours: 'Daily 11:30–21:30',
    },
    next: {
      name: 'DOPA Donburi & Dessert',
      address: 'Shop 5/6, 2 Little Hay St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: '0483 210 779',
      latitude: -33.8784749,
      longitude: 151.202973,
      hours: 'Mon–Thu 11:30–21:30; Fri–Sat 11:30–22:00; Sun 11:30–21:00',
    },
  },
  {
    expected: {
      name: 'Gumshara Ramen',
      address: 'Eating World, 25–29 Dixon St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: null,
      latitude: -33.879,
      longitude: 151.2039,
      hours: 'Wed–Mon 11:30–15:00 / 17:00–20:30; Tue Closed',
    },
    next: {
      name: 'Gumshara',
      address: '9 Kimber Lane, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: '0405 557 104',
      latitude: -33.8788096,
      longitude: 151.2036941,
      hours: 'Mon Closed; Tue–Wed 17:00–22:30; Thu–Sun 11:30–15:00, 17:00–22:30',
    },
  },
  {
    expected: {
      name: 'Arisun Express',
      address: 'Shop 35, 1 Dixon St, Sydney NSW 2000',
      area: 'Sydney CBD',
      phone: null,
      latitude: -33.876,
      longitude: 151.2046,
      hours: 'Daily 11:30–22:00',
    },
    next: {
      name: 'NUGU',
      address: 'Regent Place, 501 George St, Sydney NSW 2000',
      area: 'Sydney CBD',
      phone: '(02) 9267 5918',
      latitude: -33.8746213,
      longitude: 151.2061441,
      hours: 'Sun–Wed 12:00–21:00; Thu–Sat 12:00–21:30',
    },
  },
  {
    expected: {
      name: 'Chicken V Eastwood',
      address: '202 Rowe St, Eastwood NSW 2122',
      area: 'Eastwood',
      phone: null,
      latitude: -33.7912,
      longitude: 151.0804,
      hours: 'Daily 11:30–23:00',
    },
    next: {
      name: 'Basax Korean Chicken and Dining',
      address: '415 Pitt St, Haymarket NSW 2000',
      area: 'Haymarket',
      phone: '0475 758 282',
      latitude: -33.8784521,
      longitude: 151.2070502,
      hours: 'Mon–Thu 12:00–15:00, 17:00–23:00; Fri–Sat 12:00–00:00; Sun Closed',
    },
  },
  {
    expected: {
      name: 'Malay Chinese Takeaway',
      address: 'Shop 1, 50–58 Hunter St, Sydney NSW 2000',
      area: 'Sydney CBD',
      phone: null,
      latitude: -33.8662,
      longitude: 151.2096,
      hours: 'Mon–Fri 11:00–19:30; Weekend Closed',
    },
    next: {
      name: 'Malay Chinese Noodle Bar',
      address: 'Shop CQT06, 33 Pitt St, Sydney NSW 2000',
      area: 'Sydney CBD',
      phone: '0401607168',
      latitude: -33.862338,
      longitude: 151.2085805,
      hours: 'Mon–Fri 11:00–16:00; Sat–Sun Closed',
    },
  },
  {
    expected: {
      name: "Alberto's Lounge",
      address: '17–19 Alberta St, Sydney NSW 2000',
      area: 'Sydney CBD',
      phone: null,
      latitude: -33.8786,
      longitude: 151.2085,
      hours: 'Tue–Sat 17:00–00:00; Sun–Mon Closed',
    },
    next: {
      name: 'Fratelli Paradiso',
      address: '12–16 Challis Ave, Potts Point NSW 2011',
      area: 'Potts Point',
      phone: null,
      latitude: -33.8688512,
      longitude: 151.2252177,
      hours: 'Daily 12:00–Late',
    },
  },
  {
    expected: {
      name: 'Il Baretto',
      address: '496 Bourke St, Surry Hills NSW 2010',
      area: 'Surry Hills',
      phone: null,
      latitude: -33.8857,
      longitude: 151.2162,
      hours: 'Tue–Sun 17:30–22:00; Mon Closed',
    },
    next: {
      name: 'Il Baretto',
      address: '365 King St, Newtown NSW 2042',
      area: 'Newtown',
      phone: '0408987042',
      latitude: -33.8988877,
      longitude: 151.1775738,
      hours: 'Daily 12:00–Late',
    },
  },
  {
    expected: {
      name: 'Gigi Pizzeria',
      address: '379 King St, Newtown NSW 2042',
      area: 'Newtown',
      phone: null,
      latitude: -33.8987,
      longitude: 151.1775,
      hours: 'Daily 17:00–22:30',
    },
    next: {
      name: 'Rosso Antico Pizza Bar',
      address: 'Shop 2, 52–60 Enmore Rd, Newtown NSW 2042',
      area: 'Newtown',
      phone: '(02) 8065 4224',
      latitude: -33.8987016,
      longitude: 151.1762222,
      hours: 'Tue–Sun 18:00–22:00; Mon Closed',
    },
  },
];

const curatedVersionCorrections: CuratedVersionCorrection[] = [
  {
    legacyKey: 'real-sydney-braised-pork-rice-1-v1',
    expectedMenuName: 'Taiwanese Braised Pork Rice',
    expectedPrice: 15.5,
    menuName: 'Ground Pork Mince Sauce and Rice',
    price: 16.65,
  },
  {
    legacyKey: 'real-sydney-braised-pork-rice-2-v1',
    expectedMenuName: 'Signature Braised Pork Belly on Rice',
    expectedPrice: 17.9,
    menuName: 'Underground Lu Rou Fan',
    price: 17.9,
  },
  {
    legacyKey: 'real-sydney-dumplings-2-v1',
    expectedMenuName: 'Pan-Fried Pork & Chive Dumplings',
    expectedPrice: 13.5,
    menuName: 'Prawn Dumplings',
    price: 10.8,
  },
  {
    legacyKey: 'real-sydney-gyudon-2-v1',
    expectedMenuName: 'Onsen Egg Gyudon',
    expectedPrice: 17.5,
    menuName: 'Angus Beef Don',
    price: 24.7,
  },
  {
    legacyKey: 'real-sydney-bibimbap-1-v1',
    expectedMenuName: 'Beef Stone Pot Bibimbap',
    expectedPrice: 21,
    menuName: 'Bibimbap',
    price: 21,
  },
  {
    legacyKey: 'real-sydney-korean-fried-chicken-1-v1',
    expectedMenuName: 'Original Korean Fried Chicken',
    expectedPrice: 24,
    menuName: 'Boneless Fried Chicken',
    price: 22.9,
  },
  {
    legacyKey: 'real-sydney-carbonara-1-v1',
    expectedMenuName: 'Rigatoni alla Carbonara',
    expectedPrice: 27,
    menuName: 'Rigatoni alla Carbonara',
    price: 38,
  },
  {
    legacyKey: 'real-sydney-carbonara-2-v1',
    expectedMenuName: 'Rigatoni Carbonara',
    expectedPrice: 26,
    menuName: 'Rigatoni Carbonara',
    price: 24,
  },
  {
    legacyKey: 'real-sydney-bolognese-1-v1',
    expectedMenuName: 'Spaghetti Bolognese',
    expectedPrice: 25,
    menuName: 'Spaghetti Bolognese',
    price: 24,
  },
  {
    legacyKey: 'real-sydney-pesto-pasta-1-v1',
    expectedMenuName: 'Penne Pesto',
    expectedPrice: 24,
    menuName: 'Penne Pesto',
    price: 21,
  },
  {
    legacyKey: 'real-sydney-margherita-pizza-2-v1',
    expectedMenuName: 'Pizza Margherita',
    expectedPrice: 22,
    menuName: 'Margherita',
    price: 22,
  },
];

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
    await applyCuratedRestaurantCorrections(client);
    await applyCuratedVersionCorrections(client);

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

async function applyCuratedRestaurantCorrections(client: PoolClient): Promise<void> {
  for (const correction of curatedRestaurantCorrections) {
    const expected = correction.expected;
    const next = correction.next;
    const previousLegacyKey = realRestaurantLegacyKey(expected.name);
    const nextLegacyKey = realRestaurantLegacyKey(next.name);
    const nextSlug = slugify(next.name);
    const result = await client.query<{ id: string }>(
      `
        UPDATE restaurants AS restaurant
        SET legacy_key = $9,
            slug = $10,
            name = CASE WHEN restaurant.name IS NOT DISTINCT FROM $2 THEN $11 ELSE restaurant.name END,
            address = CASE WHEN restaurant.address IS NOT DISTINCT FROM $3 THEN $12 ELSE restaurant.address END,
            suburb = CASE WHEN restaurant.suburb IS NOT DISTINCT FROM $4 THEN $13 ELSE restaurant.suburb END,
            phone = CASE WHEN restaurant.phone IS NOT DISTINCT FROM $5 THEN $14 ELSE restaurant.phone END,
            latitude = CASE WHEN restaurant.latitude IS NOT DISTINCT FROM $6 THEN $15 ELSE restaurant.latitude END,
            longitude = CASE WHEN restaurant.longitude IS NOT DISTINCT FROM $7 THEN $16 ELSE restaurant.longitude END,
            hours_text = CASE WHEN restaurant.hours_text IS NOT DISTINCT FROM $8 THEN $17 ELSE restaurant.hours_text END
        WHERE restaurant.source = 'real_import'
          AND restaurant.legacy_key = $1
          AND NOT EXISTS (
            SELECT 1
            FROM restaurants conflict
            WHERE conflict.id <> restaurant.id
              AND (
                conflict.legacy_key = $9
                OR conflict.slug = $10
                OR (
                  lower(conflict.name) = lower($11)
                  AND lower(COALESCE(conflict.address, '')) = lower($12)
                  AND conflict.status <> 'archived'
                )
              )
          )
        RETURNING restaurant.id
      `,
      [
        previousLegacyKey,
        expected.name,
        expected.address,
        expected.area,
        expected.phone,
        expected.latitude,
        expected.longitude,
        expected.hours,
        nextLegacyKey,
        nextSlug,
        next.name,
        next.address,
        next.area,
        next.phone,
        next.latitude,
        next.longitude,
        next.hours,
      ],
    );
    if ((result.rowCount ?? 0) === 0) {
      const previous = await client.query<{ exists: boolean }>(
        `SELECT EXISTS(
          SELECT 1 FROM restaurants
          WHERE source = 'real_import' AND legacy_key = $1
        ) AS exists`,
        [previousLegacyKey],
      );
      if (previous.rows[0]?.exists) {
        throw new Error(`Restaurant correction for ${expected.name} conflicts with an existing target identity`);
      }
    }
  }
}

async function applyCuratedVersionCorrections(client: PoolClient): Promise<void> {
  for (const correction of curatedVersionCorrections) {
    await client.query(
      `
        UPDATE dish_versions
        SET menu_name = $4,
            listed_price = $5
        WHERE source = 'real_import'
          AND legacy_key = $1
          AND menu_name = $2
          AND listed_price = $3
      `,
      [
        correction.legacyKey,
        correction.expectedMenuName,
        correction.expectedPrice,
        correction.menuName,
        correction.price,
      ],
    );
  }
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
