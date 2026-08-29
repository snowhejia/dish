import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';

import {
  clearSession,
  clearSessionCookie,
  createSession,
  getSessionToken,
  hashPassword,
  requireUser,
  setSessionCookie,
  verifyPassword,
  type AuthUser,
} from './auth';
import { query, withTransaction } from './db';
import { isStorageConfigured, uploadImage } from './storage';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 40 },
  fileFilter: (_request, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) callback(null, true);
    else callback(new Error('Unsupported image format'));
  },
});

const asyncHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler => (request, response, next) => {
  void handler(request, response, next).catch(next);
};

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1).max(80),
  campus: emptyToUndefined(z.string().trim().max(80).optional()),
});

const reviewSchema = z.object({
  wouldEatAgain: z.preprocess(booleanFromForm, z.boolean()),
  text: emptyToUndefined(z.string().trim().max(4000).optional()),
  pricePaid: emptyToUndefined(z.coerce.number().min(0).max(10_000).optional()),
});

const contributionSchema = z.object({
  dishId: emptyToUndefined(z.string().trim().max(180).optional()),
  newDishName: emptyToUndefined(z.string().trim().min(1).max(160).optional()),
  restaurantId: emptyToUndefined(z.string().trim().max(180).optional()),
  newRestaurantName: emptyToUndefined(z.string().trim().min(1).max(160).optional()),
  newRestaurantAddress: emptyToUndefined(z.string().trim().max(500).optional()),
  menuName: emptyToUndefined(z.string().trim().max(180).optional()),
  price: emptyToUndefined(z.coerce.number().min(0).max(10_000).optional()),
  note: emptyToUndefined(z.string().trim().max(4000).optional()),
  wouldEatAgain: z.preprocess(optionalBooleanFromForm, z.boolean().optional()),
}).superRefine((value, context) => {
  if (!value.dishId && !value.newDishName) {
    context.addIssue({ code: 'custom', path: ['dishId'], message: 'Choose a dish or add a new one' });
  }
  if (!value.restaurantId && !value.newRestaurantName) {
    context.addIssue({ code: 'custom', path: ['restaurantId'], message: 'Choose a restaurant or add a new one' });
  }
});

router.post('/auth/register', asyncHandler(async (request, response) => {
  const input = registerSchema.parse(request.body);
  const passwordHash = await hashPassword(input.password);
  const result = await query<UserRow>(
    `INSERT INTO users (email, password_hash, display_name, campus, role, status)
     VALUES ($1, $2, $3, $4, 'user', 'active')
     RETURNING id, email::text, display_name, campus, role, status, created_at`,
    [input.email, passwordHash, input.displayName, input.campus ?? null],
  );
  const user = mapUser(result.rows[0]!);
  const session = await createSession(user.id, sessionMeta(request));
  setSessionCookie(response, session.token, session.expiresAt);
  response.status(201).json({ user, token: session.token, expiresAt: session.expiresAt.toISOString() });
}));

router.post('/auth/login', asyncHandler(async (request, response) => {
  const input = credentialsSchema.parse(request.body);
  const result = await query<UserRow & { password_hash: string }>(
    `SELECT id, email::text, password_hash, display_name, campus, role, status, created_at
     FROM users WHERE lower(email::text) = lower($1) LIMIT 1`,
    [input.email],
  );
  const row = result.rows[0];
  if (!row || row.status !== 'active' || !(await verifyPassword(input.password, row.password_hash))) {
    response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    return;
  }
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [row.id]);
  const user = mapUser(row);
  const session = await createSession(user.id, sessionMeta(request));
  setSessionCookie(response, session.token, session.expiresAt);
  response.json({ user, token: session.token, expiresAt: session.expiresAt.toISOString() });
}));

router.post('/auth/logout', requireUser, asyncHandler(async (request, response) => {
  const token = getSessionToken(request);
  if (token) await clearSession(token);
  clearSessionCookie(response);
  response.status(204).end();
}));

router.get('/auth/session', requireUser, (request, response) => {
  response.json({ user: serializeAuthUser(request.user!) });
});

router.get('/me', requireUser, (request, response) => {
  response.json({ user: serializeAuthUser(request.user!) });
});

router.patch('/me', requireUser, asyncHandler(async (request, response) => {
  const input = z.object({
    displayName: z.string().trim().min(1).max(80).optional(),
    campus: z.union([z.string().trim().max(80), z.null()]).optional(),
  }).refine((value) => value.displayName !== undefined || value.campus !== undefined, {
    message: 'At least one profile field is required',
  }).parse(request.body);
  const result = await query<UserRow>(
    `UPDATE users
     SET display_name = COALESCE($2, display_name),
         campus = CASE WHEN $3::boolean THEN $4 ELSE campus END
     WHERE id = $1
     RETURNING id, email::text, display_name, campus, role, status, created_at`,
    [request.user!.id, input.displayName ?? null, input.campus !== undefined, input.campus ?? null],
  );
  response.json({ user: mapUser(result.rows[0]!) });
}));

router.get('/catalog', asyncHandler(async (_request, response) => {
  response.json(await catalogSnapshot());
}));

router.get('/discover', asyncHandler(async (_request, response) => {
  const snapshot = await catalogSnapshot();
  response.json({ dishes: interleaveDishes(snapshot.dishes), versions: snapshot.versions });
}));

router.get('/dishes', asyncHandler(async (request, response) => {
  const snapshot = await catalogSnapshot();
  const search = stringQuery(request.query.q).toLowerCase();
  const items = search
    ? snapshot.dishes.filter((dish) => `${dish.name} ${dish.cuisine}`.toLowerCase().includes(search))
    : snapshot.dishes;
  response.json({ items });
}));

router.get('/dishes/:id', asyncHandler(async (request, response) => {
  const snapshot = await catalogSnapshot();
  const id = routeParam(request, 'id');
  const dish = snapshot.dishes.find((item) => item.id === id);
  if (!dish) return notFound(response, 'Dish');
  response.json({ dish, versions: snapshot.versions.filter((version) => version.dishId === dish.id) });
}));

router.get('/versions/:id', asyncHandler(async (request, response) => {
  const snapshot = await catalogSnapshot();
  const id = routeParam(request, 'id');
  const version = snapshot.versions.find((item) => item.id === id);
  if (!version) return notFound(response, 'Version');
  response.json({
    version,
    dish: snapshot.dishes.find((dish) => dish.id === version.dishId),
    reviews: snapshot.reviewsByVersion[version.id] ?? [],
  });
}));

router.get('/restaurants', asyncHandler(async (request, response) => {
  const snapshot = await catalogSnapshot();
  const search = stringQuery(request.query.q).toLowerCase();
  const byId = new Map<string, RestaurantDto>();
  snapshot.versions.forEach((version) => {
    const id = version.restaurantId ?? version.restaurant;
    const item = byId.get(id) ?? {
      id,
      name: version.restaurant,
      cuisine: version.cuisine,
      address: version.address,
      phone: version.phone,
      hours: version.hours,
      latitude: version.latitude,
      longitude: version.longitude,
      versions: [],
    };
    item.versions.push(version.id);
    byId.set(id, item);
  });
  const items = Array.from(byId.values()).filter((item) => !search || `${item.name} ${item.cuisine}`.toLowerCase().includes(search));
  response.json({ items });
}));

router.get('/restaurants/:id', asyncHandler(async (request, response) => {
  const id = routeParam(request, 'id');
  const snapshot = await catalogSnapshot();
  const versions = snapshot.versions.filter((version) => version.restaurantId === id || version.restaurant === id);
  if (!versions.length) return notFound(response, 'Restaurant');
  const first = versions[0]!;
  response.json({
    restaurant: {
      id: first.restaurantId ?? first.restaurant,
      name: first.restaurant,
      address: first.address,
      phone: first.phone,
      hours: first.hours,
      latitude: first.latitude,
      longitude: first.longitude,
    },
    versions,
  });
}));

router.get('/me/saved', requireUser, asyncHandler(async (request, response) => {
  const [savedDishes, savedVersions] = await Promise.all([
    query<{ id: string }>(
      `SELECT COALESCE(d.legacy_key, d.id::text) AS id
       FROM saved_dishes s JOIN dishes d ON d.id = s.dish_id
       WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
      [request.user!.id],
    ),
    query<{ id: string }>(
      `SELECT COALESCE(v.legacy_key, v.id::text) AS id
       FROM saved_versions s JOIN dish_versions v ON v.id = s.version_id
       WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
      [request.user!.id],
    ),
  ]);
  response.json({ dishes: savedDishes.rows.map((row) => row.id), versions: savedVersions.rows.map((row) => row.id) });
}));

router.put('/me/saved/dishes/:id', requireUser, asyncHandler(async (request, response) => {
  const dishId = await resolveDishId(routeParam(request, 'id'));
  if (!dishId) return notFound(response, 'Dish');
  await query('INSERT INTO saved_dishes (user_id, dish_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [request.user!.id, dishId]);
  response.status(204).end();
}));

router.delete('/me/saved/dishes/:id', requireUser, asyncHandler(async (request, response) => {
  const dishId = await resolveDishId(routeParam(request, 'id'));
  if (dishId) await query('DELETE FROM saved_dishes WHERE user_id = $1 AND dish_id = $2', [request.user!.id, dishId]);
  response.status(204).end();
}));

router.put('/me/saved/versions/:id', requireUser, asyncHandler(async (request, response) => {
  const versionId = await resolveVersionId(routeParam(request, 'id'));
  if (!versionId) return notFound(response, 'Version');
  await query('INSERT INTO saved_versions (user_id, version_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [request.user!.id, versionId]);
  response.status(204).end();
}));

router.delete('/me/saved/versions/:id', requireUser, asyncHandler(async (request, response) => {
  const versionId = await resolveVersionId(routeParam(request, 'id'));
  if (versionId) await query('DELETE FROM saved_versions WHERE user_id = $1 AND version_id = $2', [request.user!.id, versionId]);
  response.status(204).end();
}));

router.post('/versions/:id/reviews', requireUser, upload.single('photo'), asyncHandler(async (request, response) => {
  const input = reviewSchema.parse(request.body);
  const versionId = await resolveVersionId(routeParam(request, 'id'));
  if (!versionId) return notFound(response, 'Version');

  const stored = request.file ? await storeRequiredImage(request.file, 'reviews') : null;
  const reviewId = await withTransaction(async (client) => {
    const reviewResult = await client.query<{ id: string }>(
      `INSERT INTO reviews (
         version_id, user_id, author_name_snapshot, would_eat_again, body, price_paid, status, source
       ) VALUES ($1, $2, $3, $4, $5, $6, 'published', 'user')
       ON CONFLICT (version_id, user_id) WHERE user_id IS NOT NULL
       DO UPDATE SET would_eat_again = EXCLUDED.would_eat_again,
                     author_name_snapshot = EXCLUDED.author_name_snapshot,
                     body = EXCLUDED.body,
                     price_paid = EXCLUDED.price_paid,
                     status = 'published'
       RETURNING id`,
      [versionId, request.user!.id, request.user!.displayName, input.wouldEatAgain, input.text ?? null, input.pricePaid ?? null],
    );
    const id = reviewResult.rows[0]!.id;
    if (stored) {
      const mediaResult = await client.query<{ id: string }>(
        `INSERT INTO media (
           object_key, owner_user_id, purpose, status, mime_type, original_filename, byte_size, source
         ) VALUES ($1, $2, 'review', 'approved', $3, $4, $5, 'user') RETURNING id`,
        [stored.key, request.user!.id, stored.mimeType, request.file?.originalname ?? null, stored.bytes],
      );
      await client.query('DELETE FROM review_media WHERE review_id = $1', [id]);
      await client.query('INSERT INTO review_media (review_id, media_id, sort_order) VALUES ($1, $2, 0)', [id, mediaResult.rows[0]!.id]);
    }
    return id;
  });
  response.status(201).json({ id: reviewId, status: 'published' });
}));

router.get('/me/reviews', requireUser, asyncHandler(async (request, response) => {
  const result = await query<{
    id: string; version_id: string; dish_name: string; restaurant_name: string; yes: boolean;
    text: string | null; price_paid: string | null; created_at: Date; object_key: string | null;
  }>(
    `SELECT r.id, COALESCE(v.legacy_key, v.id::text) AS version_id,
            d.canonical_name AS dish_name, venue.name AS restaurant_name,
            r.would_eat_again AS yes, r.body AS text, r.price_paid, r.created_at,
            photo.object_key
     FROM reviews r
     JOIN dish_versions v ON v.id = r.version_id
     JOIN dishes d ON d.id = v.dish_id
     JOIN restaurants venue ON venue.id = v.restaurant_id
     LEFT JOIN LATERAL (
       SELECT m.object_key FROM review_media rm JOIN media m ON m.id = rm.media_id
       WHERE rm.review_id = r.id AND m.status = 'approved' ORDER BY rm.sort_order LIMIT 1
     ) photo ON true
     WHERE r.user_id = $1 ORDER BY r.created_at DESC`,
    [request.user!.id],
  );
  response.json({ reviews: result.rows.map((row) => ({
    id: row.id,
    versionId: row.version_id,
    dishName: row.dish_name,
    restaurantName: row.restaurant_name,
    yes: row.yes,
    text: row.text,
    pricePaid: row.price_paid == null ? null : Number(row.price_paid),
    photoUrl: publicMediaUrl(row.object_key),
    createdAt: row.created_at.toISOString(),
  })) });
}));

router.post('/contributions', requireUser, upload.single('photo'), asyncHandler(async (request, response) => {
  const input = contributionSchema.parse(request.body);
  const dishId = input.dishId ? await resolveDishId(input.dishId) : null;
  const restaurantId = input.restaurantId ? await resolveRestaurantId(input.restaurantId) : null;
  if (input.dishId && !dishId) return notFound(response, 'Dish');
  if (input.restaurantId && !restaurantId) return notFound(response, 'Restaurant');

  const stored = request.file ? await storeRequiredImage(request.file, 'contributions') : null;
  const id = await withTransaction(async (client) => {
    let resolvedDishId = dishId;
    if (!resolvedDishId && input.newDishName) {
      const slug = await uniqueSlug(client, 'dishes', input.newDishName);
      const created = await client.query<{ id: string }>(
        `INSERT INTO dishes (slug, canonical_name, cuisine, status, source, created_by)
         VALUES ($1, $2, 'Other', 'draft', 'contribution', $3) RETURNING id`,
        [slug, input.newDishName, request.user!.id],
      );
      resolvedDishId = created.rows[0]!.id;
    }
    if (!resolvedDishId) throw new Error('Dish is required');

    const contribution = await client.query<{ id: string }>(
      `INSERT INTO contributions (
         user_id, dish_id, restaurant_id, proposed_restaurant_name, proposed_restaurant_address,
         proposed_menu_name, price_paid, would_eat_again, notes, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') RETURNING id`,
      [
        request.user!.id,
        resolvedDishId,
        restaurantId,
        input.newRestaurantName ?? null,
        input.newRestaurantAddress ?? null,
        input.menuName ?? null,
        input.price ?? null,
        input.wouldEatAgain ?? true,
        input.note ?? null,
      ],
    );
    const contributionId = contribution.rows[0]!.id;
    if (stored) {
      const media = await client.query<{ id: string }>(
        `INSERT INTO media (
           object_key, owner_user_id, purpose, status, mime_type, original_filename, byte_size, source
         ) VALUES ($1, $2, 'contribution', 'pending', $3, $4, $5, 'user') RETURNING id`,
        [stored.key, request.user!.id, stored.mimeType, request.file?.originalname ?? null, stored.bytes],
      );
      await client.query('INSERT INTO contribution_media (contribution_id, media_id, sort_order) VALUES ($1, $2, 0)', [contributionId, media.rows[0]!.id]);
    }
    return contributionId;
  });
  response.status(201).json({ id, status: 'pending' });
}));

router.get('/me/contributions', requireUser, asyncHandler(async (request, response) => {
  const result = await query<{
    id: string; status: string; dish_name: string; restaurant_name: string | null;
    proposed_restaurant_name: string | null; proposed_menu_name: string | null;
    rejection_reason: string | null; created_at: Date;
  }>(
    `SELECT c.id, c.status, d.canonical_name AS dish_name, r.name AS restaurant_name,
            c.proposed_restaurant_name, c.proposed_menu_name, c.rejection_reason, c.created_at
     FROM contributions c
     JOIN dishes d ON d.id = c.dish_id
     LEFT JOIN restaurants r ON r.id = c.restaurant_id
     WHERE c.user_id = $1 ORDER BY c.created_at DESC`,
    [request.user!.id],
  );
  response.json({ contributions: result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    dishName: row.dish_name,
    restaurantName: row.restaurant_name ?? row.proposed_restaurant_name,
    menuName: row.proposed_menu_name,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at.toISOString(),
  })) });
}));

router.get('/me/notifications', requireUser, asyncHandler(async (request, response) => {
  const result = await query<{
    id: string; type: string; title: string; body: string; read_at: Date | null; created_at: Date;
  }>(
    `SELECT id, type, title, body, read_at, created_at
     FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [request.user!.id],
  );
  response.json({ notifications: result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    readAt: row.read_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  })) });
}));

router.patch('/me/notifications/:id/read', requireUser, asyncHandler(async (request, response) => {
  await query('UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2', [routeParam(request, 'id'), request.user!.id]);
  response.status(204).end();
}));

export function createApiRouter() {
  return router;
}

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  campus?: string | null;
  created_at: Date;
};

type DishDto = { id: string; name: string; cuisine: string; description?: string };
type VersionDto = {
  id: string;
  dishId: string;
  restaurantId: string;
  menuName?: string;
  restaurant: string;
  cuisine: string;
  metres: number;
  distanceLabel?: string;
  price: number;
  wouldEatAgain: number;
  votes: number;
  tags: string[];
  address?: string;
  phone?: string | null;
  hours?: string;
  latitude?: number | null;
  longitude?: number | null;
  galleryCount: number;
  imageUrl?: string;
  gallery?: string[];
  source: 'prototype' | 'real' | 'admin';
};
type ReviewDto = {
  id: string;
  name: string;
  yes: boolean;
  text: string;
  pricePaid: number | null;
  photoUrl: string | null;
  createdAt: string;
};
type RestaurantDto = {
  id: string; name: string; cuisine: string; address?: string; phone?: string | null; hours?: string;
  latitude?: number | null; longitude?: number | null; versions: string[];
};
type CatalogDto = { dishes: DishDto[]; versions: VersionDto[]; reviewsByVersion: Record<string, ReviewDto[]> };

async function catalogSnapshot(): Promise<CatalogDto> {
  const [dishResult, versionResult, reviewResult] = await Promise.all([
    query<{
      id: string; name: string; cuisine: string; description: string | null;
    }>(
      `SELECT COALESCE(legacy_key, id::text) AS id, canonical_name AS name, cuisine, description
       FROM dishes WHERE status = 'published' ORDER BY canonical_name`,
    ),
    query<{
      id: string; dish_id: string; restaurant_id: string; menu_name: string | null; restaurant: string;
      cuisine: string; metres: string | null; distance_label: string | null; price: string | null;
      would_eat_again: number | null; votes: number; tags: string[]; address: string | null;
      phone: string | null; hours: string | null; latitude: number | null; longitude: number | null;
      gallery_count: number; object_keys: string[]; source: string;
    }>(
      `SELECT
         COALESCE(v.legacy_key, v.id::text) AS id,
         COALESCE(d.legacy_key, d.id::text) AS dish_id,
         COALESCE(r.legacy_key, r.id::text) AS restaurant_id,
         v.menu_name, r.name AS restaurant, d.cuisine,
         CASE WHEN r.latitude IS NULL THEN NULL
              ELSE round(distance_metres(-33.8886, 151.1873, r.latitude, r.longitude))::text END AS metres,
         r.suburb AS distance_label,
         COALESCE(s.typical_price, v.listed_price)::text AS price,
         COALESCE(s.would_eat_again_percent, 0) AS would_eat_again,
         COALESCE(s.vote_count, 0) AS votes,
         COALESCE(tag_list.tags, '{}'::text[]) AS tags,
         r.address, r.phone, r.hours_text AS hours, r.latitude, r.longitude,
         COALESCE(s.gallery_count, 0) AS gallery_count,
         COALESCE(photo_list.object_keys, '{}'::text[]) AS object_keys,
         v.source
       FROM dish_versions v
       JOIN dishes d ON d.id = v.dish_id
       JOIN restaurants r ON r.id = v.restaurant_id
       LEFT JOIN version_stats s ON s.version_id = v.id
       LEFT JOIN LATERAL (
         SELECT array_agg(t.name::text ORDER BY t.name::text) AS tags
         FROM dish_version_tags vt JOIN tags t ON t.id = vt.tag_id WHERE vt.version_id = v.id
       ) tag_list ON true
       LEFT JOIN LATERAL (
         SELECT array_agg(m.object_key ORDER BY vm.is_cover DESC, vm.sort_order, m.created_at) AS object_keys
         FROM version_media vm JOIN media m ON m.id = vm.media_id
         WHERE vm.version_id = v.id AND m.status = 'approved'
       ) photo_list ON true
       WHERE v.status = 'published' AND d.status = 'published' AND r.status = 'published'
       ORDER BY d.canonical_name, r.name`,
    ),
    query<{
      id: string; version_id: string; name: string; yes: boolean; text: string | null;
      price_paid: string | null; created_at: Date; object_key: string | null;
    }>(
      `SELECT r.id, COALESCE(v.legacy_key, v.id::text) AS version_id,
              r.author_name_snapshot AS name, r.would_eat_again AS yes, r.body AS text,
              r.price_paid, r.created_at, photo.object_key
       FROM reviews r
       JOIN dish_versions v ON v.id = r.version_id
       LEFT JOIN LATERAL (
         SELECT m.object_key FROM review_media rm JOIN media m ON m.id = rm.media_id
         WHERE rm.review_id = r.id AND m.status = 'approved' ORDER BY rm.sort_order LIMIT 1
       ) photo ON true
       WHERE r.status = 'published' ORDER BY r.created_at DESC`,
    ),
  ]);

  const dishes = dishResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    cuisine: row.cuisine,
    ...(row.description ? { description: row.description } : {}),
  }));
  const versions = versionResult.rows.map((row): VersionDto => {
    const gallery = row.object_keys.map(publicMediaUrl).filter((url): url is string => Boolean(url));
    return {
      id: row.id,
      dishId: row.dish_id,
      restaurantId: row.restaurant_id,
      ...(row.menu_name ? { menuName: row.menu_name } : {}),
      restaurant: row.restaurant,
      cuisine: row.cuisine,
      metres: Number(row.metres ?? 0),
      ...(row.distance_label ? { distanceLabel: row.distance_label } : {}),
      price: Number(row.price ?? 0),
      wouldEatAgain: row.would_eat_again ?? 0,
      votes: row.votes,
      tags: row.tags,
      ...(row.address ? { address: row.address } : {}),
      phone: row.phone,
      ...(row.hours ? { hours: row.hours } : {}),
      latitude: row.latitude,
      longitude: row.longitude,
      galleryCount: Math.max(row.gallery_count, gallery.length),
      ...(gallery[0] ? { imageUrl: gallery[0], gallery } : {}),
      source: row.source === 'prototype' ? 'prototype' : row.source === 'admin' ? 'admin' : 'real',
    };
  });
  const reviewsByVersion: Record<string, ReviewDto[]> = {};
  reviewResult.rows.forEach((row) => {
    (reviewsByVersion[row.version_id] ??= []).push({
      id: row.id,
      name: row.name,
      yes: row.yes,
      text: row.text ?? '',
      pricePaid: row.price_paid == null ? null : Number(row.price_paid),
      photoUrl: publicMediaUrl(row.object_key),
      createdAt: row.created_at.toISOString(),
    });
  });
  return { dishes, versions, reviewsByVersion };
}

async function resolveDishId(identifier: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    'SELECT id FROM dishes WHERE legacy_key = $1 OR id::text = $1 LIMIT 1',
    [identifier],
  );
  return result.rows[0]?.id ?? null;
}

async function resolveVersionId(identifier: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    'SELECT id FROM dish_versions WHERE legacy_key = $1 OR id::text = $1 LIMIT 1',
    [identifier],
  );
  return result.rows[0]?.id ?? null;
}

async function resolveRestaurantId(identifier: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    'SELECT id FROM restaurants WHERE legacy_key = $1 OR id::text = $1 LIMIT 1',
    [identifier],
  );
  return result.rows[0]?.id ?? null;
}

async function storeRequiredImage(file: Express.Multer.File, folder: 'reviews' | 'contributions') {
  if (!isStorageConfigured()) {
    throw Object.assign(new Error('Cloudflare R2 is not configured on the server.'), { status: 503, code: 'STORAGE_NOT_CONFIGURED' });
  }
  return uploadImage(file, folder);
}

function publicMediaUrl(objectKey: string | null | undefined): string | null {
  if (!objectKey || !process.env.R2_PUBLIC_URL) return null;
  return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${objectKey}`;
}

function mapUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    campus: row.campus ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

function serializeAuthUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    campus: user.campus,
    createdAt: user.createdAt.toISOString(),
  };
}

function sessionMeta(request: Request) {
  return { ip: request.ip, userAgent: request.get('user-agent') ?? null };
}

function routeParam(request: Request, name: string): string {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function stringQuery(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function notFound(response: Response, entity: string): void {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: `${entity} not found.` } });
}

function emptyToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => value === '' || value === null ? undefined : value, schema);
}

function booleanFromForm(value: unknown): unknown {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (['true', 'yes', '1', 'YES'].includes(value)) return true;
    if (['false', 'no', '0', 'NO'].includes(value)) return false;
  }
  return value;
}

function optionalBooleanFromForm(value: unknown): unknown {
  return value === '' || value === null || value === undefined ? undefined : booleanFromForm(value);
}

async function uniqueSlug(client: { query: typeof query }, table: 'dishes' | 'restaurants', value: string): Promise<string> {
  const base = value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'item';
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix ? `${base}-${suffix + 1}` : base;
    const result = await client.query(`SELECT 1 FROM ${table} WHERE slug = $1`, [slug]);
    if (!result.rowCount) return slug;
  }
  return `${base}-${Date.now()}`;
}

function interleaveDishes(items: DishDto[]): DishDto[] {
  const groups = new Map<string, DishDto[]>();
  items.forEach((dish) => groups.set(dish.cuisine, [...(groups.get(dish.cuisine) ?? []), dish]));
  const queues = Array.from(groups.values());
  const result: DishDto[] = [];
  let row = 0;
  while (result.length < items.length) {
    queues.forEach((queue) => {
      if (queue[row]) result.push(queue[row]!);
    });
    row += 1;
  }
  return result;
}

export { catalogSnapshot };
