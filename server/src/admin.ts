import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import type { QueryResult, QueryResultRow } from 'pg';
import { z } from 'zod';

export type AdminQuery = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: readonly unknown[],
) => Promise<QueryResult<T>>;

export type AdminUpload = (
  file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
  folder: 'versions' | 'reviews' | 'contributions',
) => Promise<{ key: string; url: string; mimeType: string; bytes: number }>;

type SessionResult = { id: string; token: string; expiresAt: Date };

export type AdminAuth = {
  hashPassword?: (password: string) => Promise<string>;
  verifyPassword: (password: string, encodedHash: string) => Promise<boolean>;
  createSession: (
    userId: string,
    meta?: { ip?: string | null; userAgent?: string | null; ttlMs?: number },
  ) => Promise<SessionResult>;
  setSessionCookie: (response: Response, token: string, expiresAt: Date) => void;
  clearSessionCookie: (response: Response) => void;
  clearSession?: (token: string) => Promise<void>;
  sessionCookieName?: string;
};

export type AdminDependencies = {
  query: AdminQuery;
  requireAdmin: RequestHandler;
  auth?: AdminAuth;
  upload?: AdminUpload;
};

type AdminRequest = Request & {
  user?: {
    id: string;
    email: string;
    displayName?: string | null;
    role?: string;
    status?: string;
  };
  adminUploadError?: string;
};

type ValidationIssue = { path: PropertyKey[]; message: string };
type FormErrors = Record<string, string>;
type FormValues = Record<string, unknown>;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 40 },
  fileFilter: (_request, file, callback) => {
    const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (supported.includes(file.mimetype)) callback(null, true);
    else callback(new Error('Unsupported image format'));
  },
}).single('photo');

const optionalText = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? null : value,
  z.string().trim().nullable().optional(),
);

const optionalNumber = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? null : value,
  z.coerce.number().finite().nullable().optional(),
);

const statusSchema = z.enum(['draft', 'published', 'archived']);

const restaurantSchema = z.object({
  name: z.string().trim().min(1, 'Restaurant name is required').max(160),
  address: optionalText,
  suburb: optionalText,
  state: optionalText,
  postcode: optionalText,
  latitude: optionalNumber.refine((value) => value == null || (value >= -90 && value <= 90), 'Latitude must be between -90 and 90'),
  longitude: optionalNumber.refine((value) => value == null || (value >= -180 && value <= 180), 'Longitude must be between -180 and 180'),
  phone: optionalText,
  website_url: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? null : value,
    z.string().trim().url('Enter a valid URL').nullable().optional(),
  ),
  hours_text: optionalText,
  status: statusSchema.default('published'),
}).superRefine((data, context) => {
  const hasLatitude = data.latitude != null;
  const hasLongitude = data.longitude != null;
  if (hasLatitude === hasLongitude) return;
  context.addIssue({
    code: 'custom',
    path: [hasLatitude ? 'longitude' : 'latitude'],
    message: 'Latitude and longitude must be provided together',
  });
});

const dishSchema = z.object({
  canonical_name: z.string().trim().min(1, 'Dish name is required').max(160),
  cuisine: z.string().trim().min(1, 'Cuisine is required').max(120),
  dish_type: optionalText,
  description: optionalText,
  aliases: optionalText,
  status: statusSchema.default('published'),
});

const versionSchema = z.object({
  dish_id: z.string().uuid('Choose a dish'),
  restaurant_id: z.string().uuid('Choose a restaurant'),
  menu_name: optionalText,
  description: optionalText,
  listed_price: optionalNumber.refine((value) => value == null || (value >= 0 && value <= 10000), 'Price must be between 0 and 10,000'),
  tags: optionalText,
  status: statusSchema.default('published'),
});

const userSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  display_name: z.string().trim().min(1, 'Display name is required').max(80),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  campus: optionalText,
  status: z.enum(['active', 'suspended']).default('active'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const contributionApprovalSchema = z.object({
  restaurant_id: z.string().uuid('Choose a restaurant'),
  menu_name: optionalText,
  listed_price: optionalNumber.refine((value) => value == null || (value >= 0 && value <= 10000), 'Price must be between 0 and 10,000'),
});

const contributionRejectionSchema = z.object({
  rejection_reason: z.string().trim().min(3, 'Give the contributor a short reason').max(1000),
});

const safeHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler => (request, response, next) => {
  void handler(request, response, next).catch(next);
};

function values(request: Request): FormValues {
  return typeof request.body === 'object' && request.body !== null
    ? request.body as FormValues
    : {};
}

function errorsFromIssues(issues: ValidationIssue[]): FormErrors {
  return Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? '_form'), issue.message]));
}

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

function escapeHtml(value: unknown): string {
  return text(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function attr(value: unknown): string {
  return escapeHtml(value);
}

function statusBadge(status: unknown): string {
  const label = text(status) || 'unknown';
  const css = label.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return `<span class="badge ${css}">${escapeHtml(label)}</span>`;
}

function inputField({
  name,
  label,
  value,
  error,
  type = 'text',
  required = false,
  full = false,
  hint,
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  value?: unknown;
  error?: string;
  type?: string;
  required?: boolean;
  full?: boolean;
  hint?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
}): string {
  return `<div class="field${full ? ' full' : ''}">
    <label for="${attr(name)}">${escapeHtml(label)}</label>
    <input class="field-control" id="${attr(name)}" name="${attr(name)}" type="${attr(type)}" value="${attr(value)}"${required ? ' required' : ''}${min != null ? ` min="${attr(min)}"` : ''}${max != null ? ` max="${attr(max)}"` : ''}${step != null ? ` step="${attr(step)}"` : ''}>
    ${hint ? `<p class="field-hint">${escapeHtml(hint)}</p>` : ''}
    ${error ? `<p class="field-error">${escapeHtml(error)}</p>` : ''}
  </div>`;
}

function textareaField({
  name,
  label,
  value,
  error,
  full = true,
  hint,
}: {
  name: string;
  label: string;
  value?: unknown;
  error?: string;
  full?: boolean;
  hint?: string;
}): string {
  return `<div class="field${full ? ' full' : ''}">
    <label for="${attr(name)}">${escapeHtml(label)}</label>
    <textarea class="field-control" id="${attr(name)}" name="${attr(name)}">${escapeHtml(value)}</textarea>
    ${hint ? `<p class="field-hint">${escapeHtml(hint)}</p>` : ''}
    ${error ? `<p class="field-error">${escapeHtml(error)}</p>` : ''}
  </div>`;
}

function selectField({
  name,
  label,
  value,
  options,
  error,
  required = false,
  full = false,
}: {
  name: string;
  label: string;
  value?: unknown;
  options: Array<{ value: unknown; label: unknown }>;
  error?: string;
  required?: boolean;
  full?: boolean;
}): string {
  const current = text(value);
  return `<div class="field${full ? ' full' : ''}">
    <label for="${attr(name)}">${escapeHtml(label)}</label>
    <select class="field-control" id="${attr(name)}" name="${attr(name)}"${required ? ' required' : ''}>
      ${options.map((option) => `<option value="${attr(option.value)}"${text(option.value) === current ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
    </select>
    ${error ? `<p class="field-error">${escapeHtml(error)}</p>` : ''}
  </div>`;
}

function photoField(url?: unknown): string {
  return `<div class="field full">
    <label for="photo">Photo</label>
    ${url ? `<img class="photo-preview" src="${attr(url)}" alt="Current photo">` : ''}
    <input class="field-control" id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif">
    <p class="field-hint">JPEG, PNG, WebP, HEIC or HEIF. Maximum 10 MB.</p>
  </div>`;
}

const navItems = [
  { key: 'dashboard', href: '/admin', label: 'Dashboard' },
  { key: 'restaurants', href: '/admin/restaurants', label: 'Restaurants' },
  { key: 'dishes', href: '/admin/dishes', label: 'Dishes' },
  { key: 'versions', href: '/admin/versions', label: 'Versions' },
  { key: 'contributions', href: '/admin/contributions', label: 'Contributions' },
  { key: 'reviews', href: '/admin/reviews', label: 'Reviews' },
  { key: 'users', href: '/admin/users', label: 'Users' },
] as const;

function layout({
  title,
  active,
  subtitle,
  body,
  request,
  action,
  alert,
}: {
  title: string;
  active: string;
  subtitle?: string;
  body: string;
  request: AdminRequest;
  action?: string;
  alert?: { type: 'success' | 'error'; message: string };
}): string {
  const currentUser = request.user;
  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>${escapeHtml(title)} · Dish. Admin</title>
    <link rel="stylesheet" href="/admin/admin.css">
  </head>
  <body>
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <a class="admin-brand" href="/admin">DISH. ADMIN</a>
        <nav class="admin-nav" aria-label="Admin navigation">
          ${navItems.map((item) => `<a href="${item.href}"${item.key === active ? ' aria-current="page"' : ''}>${item.label}</a>`).join('')}
        </nav>
      </aside>
      <main class="admin-main">
        <div class="admin-content">
          <header class="admin-topbar">
            <div><h1>${escapeHtml(title)}</h1>${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}</div>
            <div class="row-actions">
              ${action ?? ''}
              <form class="logout-form" method="post" action="/admin/logout"><button class="button secondary small" type="submit">Sign out${currentUser?.displayName ? ` · ${escapeHtml(currentUser.displayName)}` : ''}</button></form>
            </div>
          </header>
          ${alert ? `<div class="alert ${alert.type}" role="alert">${escapeHtml(alert.message)}</div>` : ''}
          ${body}
        </div>
      </main>
    </div>
  </body>
  </html>`;
}

function loginPage(values: FormValues = {}, errors: FormErrors = {}, message?: string): string {
  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Sign in · Dish. Admin</title>
    <link rel="stylesheet" href="/admin/admin.css">
  </head>
  <body class="auth-page">
    <main class="auth-card">
      <div class="auth-brand">DISH. ADMIN</div>
      <h1>Sign in</h1>
      <p class="subtitle">Use an administrator account.</p>
      ${message ? `<div class="alert error" role="alert">${escapeHtml(message)}</div>` : ''}
      <form class="admin-form" method="post" action="/admin/login">
        ${inputField({ name: 'email', label: 'Email', type: 'email', value: values.email, error: errors.email, required: true, full: true })}
        ${inputField({ name: 'password', label: 'Password', type: 'password', error: errors.password, required: true, full: true })}
        <button class="button" type="submit">Sign in</button>
      </form>
    </main>
  </body>
  </html>`;
}

function messageFromQuery(request: Request): { type: 'success' | 'error'; message: string } | undefined {
  if (request.query.saved === '1') return { type: 'success', message: 'Changes saved.' };
  if (request.query.created === '1') return { type: 'success', message: 'Item created.' };
  if (request.query.archived === '1') return { type: 'success', message: 'Item archived.' };
  if (request.query.approved === '1') return { type: 'success', message: 'Contribution approved.' };
  if (request.query.rejected === '1') return { type: 'success', message: 'Contribution rejected.' };
  return undefined;
}

function parseTags(value: string | null | undefined): string[] {
  return value?.split(',').map((tag) => tag.trim()).filter(Boolean) ?? [];
}

function tagsForForm(value: unknown): string {
  return Array.isArray(value) ? value.map(text).join(', ') : text(value);
}

function slugify(value: string): string {
  const slug = value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return slug || `item-${randomUUID().slice(0, 8)}`;
}

function uniqueSlug(value: string): string {
  return `${slugify(value).slice(0, 110)}-${randomUUID().slice(0, 8)}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(text(value));
  return Number.isNaN(date.getTime())
    ? text(value)
    : new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatMoney(value: unknown): string {
  if (value == null || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount) : text(value);
}

function mediaUrl(objectKey: unknown): string | undefined {
  if (!objectKey) return undefined;
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
  return base ? `${base}/${encodeURI(text(objectKey))}` : undefined;
}

function actorId(request: Request): string {
  const id = (request as AdminRequest).user?.id;
  if (!id) throw new Error('Administrator session is missing a user id');
  return id;
}

function routeParam(request: Request, name: string): string {
  const value = request.params[name];
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) throw new Error(`Missing route parameter: ${name}`);
  return resolved;
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator < 1 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function uploadMiddleware(request: Request, response: Response, next: NextFunction): void {
  imageUpload(request, response, (error) => {
    if (error) {
      (request as AdminRequest).adminUploadError = error instanceof Error ? error.message : 'Image upload failed';
    }
    next();
  });
}

export function createAdminRouter(dependencies: AdminDependencies): Router {
  const router = Router();

  router.get('/admin.css', (_request, response) => {
    response.sendFile(resolve(__dirname, '../public/admin.css'));
  });

  router.use((request, response, next) => {
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
      next();
      return;
    }
    const origin = request.get('origin');
    const expectedOrigin = `${request.protocol}://${request.get('host')}`;
    if (origin && origin !== expectedOrigin && origin !== process.env.ADMIN_ORIGIN) {
      response.status(403).type('text').send('Cross-origin admin action rejected.');
      return;
    }
    next();
  });

  router.get('/login', (_request, response) => {
    response.type('html').send(loginPage());
  });

  router.post('/login', safeHandler(async (request, response) => {
    const parsed = loginSchema.safeParse(values(request));
    if (!parsed.success) {
      response.status(400).type('html').send(loginPage(values(request), errorsFromIssues(parsed.error.issues)));
      return;
    }

    if (!dependencies.auth) {
      response.status(503).type('html').send(loginPage(parsed.data, {}, 'Authentication is not configured.'));
      return;
    }

    const result = await dependencies.query<{
      id: string;
      password_hash: string;
      role: string;
      status: string;
    }>(
      `select id, password_hash, role, status
       from users
       where lower(email) = lower($1)
       limit 1`,
      [parsed.data.email],
    );
    const user = result.rows[0];
    const valid = user
      && user.role === 'admin'
      && user.status === 'active'
      && await dependencies.auth.verifyPassword(parsed.data.password, user.password_hash);

    if (!valid) {
      response.status(401).type('html').send(loginPage({ email: parsed.data.email }, {}, 'Email or password is incorrect, or this account is not an administrator.'));
      return;
    }

    const session = await dependencies.auth.createSession(user.id, {
      ip: request.ip,
      userAgent: request.get('user-agent') ?? null,
    });
    dependencies.auth.setSessionCookie(response, session.token, session.expiresAt);
    response.redirect(303, '/admin');
  }));

  router.use(dependencies.requireAdmin);

  router.post('/logout', safeHandler(async (request, response) => {
    const token = parseCookie(request.headers.cookie, dependencies.auth?.sessionCookieName ?? 'dish_session') ?? '';
    if (token && dependencies.auth?.clearSession) await dependencies.auth.clearSession(token);
    dependencies.auth?.clearSessionCookie(response);
    response.redirect(303, '/admin/login');
  }));

  registerDashboard(router, dependencies);
  registerRestaurants(router, dependencies);
  registerDishes(router, dependencies);
  registerVersions(router, dependencies);
  registerContributions(router, dependencies);
  registerReviews(router, dependencies);
  registerUsers(router, dependencies);

  return router;
}

// Resource route registration is kept below the shared presentation helpers so
// the API server can inject its database, authentication and R2 implementations.
function registerDashboard(router: Router, dependencies: AdminDependencies): void {
  router.get('/', safeHandler(async (request, response) => {
    const [restaurants, dishes, versions, pending, reviews, recent] = await Promise.all([
      dependencies.query<{ count: string }>("select count(*)::text as count from restaurants where status <> 'archived'"),
      dependencies.query<{ count: string }>("select count(*)::text as count from dishes where status <> 'archived'"),
      dependencies.query<{ count: string }>("select count(*)::text as count from dish_versions where status <> 'archived'"),
      dependencies.query<{ count: string }>("select count(*)::text as count from contributions where status = 'pending'"),
      dependencies.query<{ count: string }>("select count(*)::text as count from reviews where status = 'published'"),
      dependencies.query<{
        id: string;
        user_name: string;
        dish_name: string;
        proposed_menu_name: string | null;
        status: string;
        created_at: Date;
      }>(`
        select c.id, u.display_name as user_name, d.canonical_name as dish_name,
               c.proposed_menu_name, c.status, c.created_at
        from contributions c
        join users u on u.id = c.user_id
        join dishes d on d.id = c.dish_id
        order by (c.status = 'pending') desc, c.created_at desc
        limit 8
      `),
    ]);

    const count = (result: QueryResult<{ count: string }>) => Number.parseInt(result.rows[0]?.count ?? '0', 10);
    const stats = [
      ['Restaurants', count(restaurants)],
      ['Dishes', count(dishes)],
      ['Versions', count(versions)],
      ['Pending', count(pending)],
    ];
    const recentRows = recent.rows.map((row) => `<tr>
      <td data-label="Contribution"><a class="entity-link" href="/admin/contributions/${attr(row.id)}">${escapeHtml(row.proposed_menu_name ?? row.dish_name)}</a></td>
      <td data-label="Submitted by">${escapeHtml(row.user_name)}</td>
      <td data-label="Dish">${escapeHtml(row.dish_name)}</td>
      <td data-label="Status">${statusBadge(row.status)}</td>
      <td data-label="Submitted">${escapeHtml(formatDate(row.created_at))}</td>
      <td class="actions-cell"><a class="button secondary small" href="/admin/contributions/${attr(row.id)}">Review</a></td>
    </tr>`).join('');

    const body = `
      <section class="stats-grid">
        ${stats.map(([label, value]) => `<article class="stat-card"><div class="stat-value">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></article>`).join('')}
      </section>
      <section class="panel">
        <div class="panel-header section-heading"><h2>Recent contributions</h2><a class="button secondary small" href="/admin/contributions">View queue</a></div>
        ${recentRows ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Contribution</th><th>Submitted by</th><th>Dish</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>${recentRows}</tbody></table></div>` : '<div class="empty">No contributions yet.</div>'}
      </section>
      <section class="panel"><div class="panel-body"><strong>${count(reviews)}</strong> published reviews are currently visible in the app.</div></section>`;

    response.type('html').send(layout({
      title: 'Dashboard',
      active: 'dashboard',
      subtitle: 'Live content and moderation overview.',
      body,
      request: request as AdminRequest,
      alert: messageFromQuery(request),
    }));
  }));
}
function registerRestaurants(router: Router, dependencies: AdminDependencies): void {
  type RestaurantRow = QueryResultRow & {
    id: string;
    name: string;
    address: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    phone: string | null;
    website_url: string | null;
    latitude: number | null;
    longitude: number | null;
    hours_text: string | null;
    status: string;
    version_count?: number;
    updated_at?: Date;
  };

  const renderForm = (request: Request, row: FormValues, errors: FormErrors, editing = false, message?: string, messageType: 'success' | 'error' = 'error') => {
    const body = `<section class="panel"><div class="panel-body">
      ${message ? `<div class="alert ${messageType}" role="alert">${escapeHtml(message)}</div>` : ''}
      <form class="admin-form" method="post" action="${editing ? `/admin/restaurants/${attr(row.id)}` : '/admin/restaurants'}">
        <div class="form-grid">
          ${inputField({ name: 'name', label: 'Restaurant name', value: row.name, error: errors.name, required: true })}
          ${selectField({ name: 'status', label: 'Status', value: row.status ?? 'published', options: ['draft', 'published', 'archived'].map((value) => ({ value, label: value })) })}
          ${inputField({ name: 'address', label: 'Street address', value: row.address, error: errors.address, full: true })}
          ${inputField({ name: 'suburb', label: 'Suburb / area', value: row.suburb, error: errors.suburb })}
          ${inputField({ name: 'state', label: 'State', value: row.state ?? 'NSW', error: errors.state })}
          ${inputField({ name: 'postcode', label: 'Postcode', value: row.postcode, error: errors.postcode })}
          ${inputField({ name: 'phone', label: 'Phone', type: 'tel', value: row.phone, error: errors.phone })}
          ${inputField({ name: 'website_url', label: 'Website URL', type: 'url', value: row.website_url, error: errors.website_url, full: true })}
          ${inputField({ name: 'latitude', label: 'Latitude', type: 'number', step: 'any', value: row.latitude, error: errors.latitude })}
          ${inputField({ name: 'longitude', label: 'Longitude', type: 'number', step: 'any', value: row.longitude, error: errors.longitude })}
          ${textareaField({ name: 'hours_text', label: 'Opening hours', value: row.hours_text, error: errors.hours_text, hint: 'Free text shown in the first version. Structured hours can be added later.' })}
        </div>
        <div class="form-actions"><a class="button secondary" href="/admin/restaurants">Cancel</a><button class="button" type="submit">${editing ? 'Save restaurant' : 'Create restaurant'}</button></div>
      </form>
      ${editing ? `<form method="post" action="/admin/restaurants/${attr(row.id)}/archive"><button class="button danger small" type="submit">Archive restaurant</button></form>` : ''}
    </div></section>`;
    return layout({ title: editing ? 'Edit restaurant' : 'New restaurant', active: 'restaurants', body, request: request as AdminRequest });
  };

  router.get('/restaurants', safeHandler(async (request, response) => {
    const search = text(request.query.q).trim();
    const result = await dependencies.query<RestaurantRow>(`
      select r.id, r.name, r.address, r.suburb, r.state, r.postcode, r.phone,
             r.status, r.updated_at, count(v.id)::int as version_count
      from restaurants r
      left join dish_versions v on v.restaurant_id = r.id and v.status <> 'archived'
      where ($1 = '' or r.name ilike '%' || $1 || '%' or coalesce(r.suburb, '') ilike '%' || $1 || '%')
      group by r.id
      order by (r.status = 'archived'), lower(r.name)
      limit 250
    `, [search]);
    const rows = result.rows.map((row) => `<tr>
      <td data-label="Restaurant"><a class="entity-link" href="/admin/restaurants/${attr(row.id)}">${escapeHtml(row.name)}</a></td>
      <td data-label="Location">${escapeHtml([row.suburb, row.state].filter(Boolean).join(', ') || row.address || '—')}</td>
      <td data-label="Versions">${escapeHtml(row.version_count ?? 0)}</td>
      <td data-label="Status">${statusBadge(row.status)}</td>
      <td data-label="Updated">${escapeHtml(formatDate(row.updated_at))}</td>
      <td class="actions-cell"><a class="button secondary small" href="/admin/restaurants/${attr(row.id)}">Edit</a></td>
    </tr>`).join('');
    const body = `<div class="toolbar"><form method="get" action="/admin/restaurants"><input class="field-control" type="search" name="q" value="${attr(search)}" placeholder="Search restaurant or suburb"><button class="button secondary" type="submit">Search</button></form></div>
      <section class="panel">${rows ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Restaurant</th><th>Location</th><th>Versions</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">No restaurants found.</div>'}</section>`;
    response.type('html').send(layout({ title: 'Restaurants', active: 'restaurants', subtitle: `${result.rows.length} records`, body, request: request as AdminRequest, action: '<a class="button" href="/admin/restaurants/new">Add restaurant</a>', alert: messageFromQuery(request) }));
  }));

  router.get('/restaurants/new', (request, response) => {
    response.type('html').send(renderForm(request, { status: 'published', state: 'NSW' }, {}));
  });

  router.post('/restaurants', safeHandler(async (request, response) => {
    const parsed = restaurantSchema.safeParse(values(request));
    if (!parsed.success) {
      response.status(400).type('html').send(renderForm(request, values(request), errorsFromIssues(parsed.error.issues)));
      return;
    }
    try {
      const data = parsed.data;
      const result = await dependencies.query<{ id: string }>(`
        insert into restaurants
          (slug, name, address, suburb, state, postcode, phone, website_url, latitude, longitude, hours_text, status, source, created_by, published_at)
        values
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'admin',$13,case when $12 = 'published' then now() else null end)
        returning id
      `, [uniqueSlug(data.name), data.name, data.address, data.suburb, data.state, data.postcode, data.phone, data.website_url, data.latitude, data.longitude, data.hours_text, data.status, actorId(request)]);
      response.redirect(303, `/admin/restaurants/${result.rows[0]?.id}?created=1`);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      response.status(409).type('html').send(renderForm(request, values(request), {}, false, 'A restaurant with this name and address already exists.'));
    }
  }));

  router.get('/restaurants/:id', safeHandler(async (request, response) => {
    const result = await dependencies.query<RestaurantRow>('select * from restaurants where id = $1', [request.params.id]);
    const row = result.rows[0];
    if (!row) { response.status(404).send('Restaurant not found'); return; }
    const notice = messageFromQuery(request);
    response.type('html').send(renderForm(request, row, {}, true, notice?.message, notice?.type));
  }));

  router.post('/restaurants/:id', safeHandler(async (request, response) => {
    const parsed = restaurantSchema.safeParse(values(request));
    if (!parsed.success) {
      response.status(400).type('html').send(renderForm(request, { id: request.params.id, ...values(request) }, errorsFromIssues(parsed.error.issues), true));
      return;
    }
    try {
      const data = parsed.data;
      const result = await dependencies.query<{ id: string }>(`
        update restaurants set
          name=$2,address=$3,suburb=$4,state=$5,postcode=$6,phone=$7,website_url=$8,
          latitude=$9,longitude=$10,hours_text=$11,status=$12,
          published_at=case when $12='published' then coalesce(published_at,now()) else published_at end
        where id=$1 returning id
      `, [request.params.id, data.name, data.address, data.suburb, data.state, data.postcode, data.phone, data.website_url, data.latitude, data.longitude, data.hours_text, data.status]);
      if (!result.rows[0]) { response.status(404).send('Restaurant not found'); return; }
      response.redirect(303, `/admin/restaurants/${request.params.id}?saved=1`);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      response.status(409).type('html').send(renderForm(request, { id: request.params.id, ...values(request) }, {}, true, 'A restaurant with this name and address already exists.'));
    }
  }));

  router.post('/restaurants/:id/archive', safeHandler(async (request, response) => {
    await dependencies.query("update restaurants set status='archived' where id=$1", [request.params.id]);
    response.redirect(303, '/admin/restaurants?archived=1');
  }));
}
function registerDishes(router: Router, dependencies: AdminDependencies): void {
  type DishRow = QueryResultRow & {
    id: string;
    canonical_name: string;
    cuisine: string;
    dish_type: string | null;
    description: string | null;
    aliases: string[] | null;
    status: string;
    version_count?: number;
    updated_at?: Date;
  };

  const renderForm = (request: Request, row: FormValues, errors: FormErrors, editing = false, message?: string) => {
    const body = `<section class="panel"><div class="panel-body">
      ${message ? `<div class="alert error" role="alert">${escapeHtml(message)}</div>` : ''}
      <form class="admin-form" method="post" action="${editing ? `/admin/dishes/${attr(row.id)}` : '/admin/dishes'}">
        <div class="form-grid">
          ${inputField({ name: 'canonical_name', label: 'Canonical dish name', value: row.canonical_name, error: errors.canonical_name, required: true })}
          ${inputField({ name: 'cuisine', label: 'Cuisine', value: row.cuisine, error: errors.cuisine, required: true })}
          ${inputField({ name: 'dish_type', label: 'Dish type', value: row.dish_type, error: errors.dish_type })}
          ${selectField({ name: 'status', label: 'Status', value: row.status ?? 'published', options: ['draft', 'published', 'archived'].map((value) => ({ value, label: value })) })}
          ${inputField({ name: 'aliases', label: 'Aliases', value: tagsForForm(row.aliases), error: errors.aliases, full: true, hint: 'Comma-separated alternate names used in search.' })}
          ${textareaField({ name: 'description', label: 'Description', value: row.description, error: errors.description })}
        </div>
        <div class="form-actions"><a class="button secondary" href="/admin/dishes">Cancel</a><button class="button" type="submit">${editing ? 'Save dish' : 'Create dish'}</button></div>
      </form>
      ${editing ? `<form method="post" action="/admin/dishes/${attr(row.id)}/archive"><button class="button danger small" type="submit">Archive dish</button></form>` : ''}
    </div></section>`;
    return layout({ title: editing ? 'Edit dish' : 'New dish', active: 'dishes', body, request: request as AdminRequest });
  };

  const replaceAliases = async (dishId: string, rawAliases: string | null | undefined) => {
    const aliases = [...new Set(parseTags(rawAliases).map((alias) => alias.slice(0, 160)))];
    await dependencies.query('delete from dish_aliases where dish_id=$1', [dishId]);
    if (aliases.length) {
      await dependencies.query(`insert into dish_aliases (dish_id, alias)
        select $1, alias from unnest($2::text[]) alias on conflict (dish_id, alias) do nothing`, [dishId, aliases]);
    }
  };

  router.get('/dishes', safeHandler(async (request, response) => {
    const search = text(request.query.q).trim();
    const result = await dependencies.query<DishRow>(`
      select d.id, d.canonical_name, d.cuisine, d.dish_type, d.status, d.updated_at,
             count(distinct v.id)::int as version_count
      from dishes d
      left join dish_versions v on v.dish_id=d.id and v.status <> 'archived'
      left join dish_aliases a on a.dish_id=d.id
      where ($1='' or d.canonical_name ilike '%'||$1||'%' or d.cuisine ilike '%'||$1||'%' or a.alias::text ilike '%'||$1||'%')
      group by d.id
      order by (d.status='archived'), lower(d.canonical_name)
      limit 250
    `, [search]);
    const rows = result.rows.map((row) => `<tr>
      <td data-label="Dish"><a class="entity-link" href="/admin/dishes/${attr(row.id)}">${escapeHtml(row.canonical_name)}</a></td>
      <td data-label="Cuisine">${escapeHtml(row.cuisine)}</td>
      <td data-label="Type">${escapeHtml(row.dish_type ?? '—')}</td>
      <td data-label="Versions">${escapeHtml(row.version_count ?? 0)}</td>
      <td data-label="Status">${statusBadge(row.status)}</td>
      <td class="actions-cell"><a class="button secondary small" href="/admin/dishes/${attr(row.id)}">Edit</a></td>
    </tr>`).join('');
    const body = `<div class="toolbar"><form method="get" action="/admin/dishes"><input class="field-control" type="search" name="q" value="${attr(search)}" placeholder="Search dish, cuisine or alias"><button class="button secondary" type="submit">Search</button></form></div>
      <section class="panel">${rows ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Dish</th><th>Cuisine</th><th>Type</th><th>Versions</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">No dishes found.</div>'}</section>`;
    response.type('html').send(layout({ title: 'Dishes', active: 'dishes', subtitle: `${result.rows.length} records`, body, request: request as AdminRequest, action: '<a class="button" href="/admin/dishes/new">Add dish</a>', alert: messageFromQuery(request) }));
  }));

  router.get('/dishes/new', (request, response) => {
    response.type('html').send(renderForm(request, { status: 'published' }, {}));
  });

  router.post('/dishes', safeHandler(async (request, response) => {
    const parsed = dishSchema.safeParse(values(request));
    if (!parsed.success) {
      response.status(400).type('html').send(renderForm(request, values(request), errorsFromIssues(parsed.error.issues)));
      return;
    }
    try {
      const data = parsed.data;
      const result = await dependencies.query<{ id: string }>(`
        insert into dishes (slug,canonical_name,cuisine,dish_type,description,status,source,created_by,published_at)
        values ($1,$2,$3,$4,$5,$6,'admin',$7,case when $6='published' then now() else null end)
        returning id
      `, [uniqueSlug(data.canonical_name), data.canonical_name, data.cuisine, data.dish_type, data.description, data.status, actorId(request)]);
      const id = result.rows[0]?.id;
      if (!id) throw new Error('Dish insert did not return an id');
      await replaceAliases(id, data.aliases);
      response.redirect(303, `/admin/dishes/${id}?created=1`);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      response.status(409).type('html').send(renderForm(request, values(request), {}, false, 'A dish with this name and cuisine, or one of these aliases, already exists.'));
    }
  }));

  router.get('/dishes/:id', safeHandler(async (request, response) => {
    const result = await dependencies.query<DishRow>(`
      select d.*, coalesce(array_agg(a.alias::text order by a.alias::text) filter (where a.id is not null), '{}') as aliases
      from dishes d left join dish_aliases a on a.dish_id=d.id
      where d.id=$1 group by d.id
    `, [request.params.id]);
    const row = result.rows[0];
    if (!row) { response.status(404).send('Dish not found'); return; }
    response.type('html').send(renderForm(request, row, {}, true));
  }));

  router.post('/dishes/:id', safeHandler(async (request, response) => {
    const parsed = dishSchema.safeParse(values(request));
    if (!parsed.success) {
      response.status(400).type('html').send(renderForm(request, { id: request.params.id, ...values(request) }, errorsFromIssues(parsed.error.issues), true));
      return;
    }
    try {
      const data = parsed.data;
      const result = await dependencies.query<{ id: string }>(`
        update dishes set canonical_name=$2,cuisine=$3,dish_type=$4,description=$5,status=$6,
          published_at=case when $6='published' then coalesce(published_at,now()) else published_at end
        where id=$1 returning id
      `, [request.params.id, data.canonical_name, data.cuisine, data.dish_type, data.description, data.status]);
      if (!result.rows[0]) { response.status(404).send('Dish not found'); return; }
      await replaceAliases(routeParam(request, 'id'), data.aliases);
      response.redirect(303, `/admin/dishes/${request.params.id}?saved=1`);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      response.status(409).type('html').send(renderForm(request, { id: request.params.id, ...values(request) }, {}, true, 'A dish with this name and cuisine, or one of these aliases, already exists.'));
    }
  }));

  router.post('/dishes/:id/archive', safeHandler(async (request, response) => {
    await dependencies.query("update dishes set status='archived' where id=$1", [request.params.id]);
    response.redirect(303, '/admin/dishes?archived=1');
  }));
}
function registerVersions(router: Router, dependencies: AdminDependencies): void {
  type VersionRow = QueryResultRow & {
    id: string;
    dish_id: string;
    restaurant_id: string;
    menu_name: string | null;
    description: string | null;
    listed_price: string | number | null;
    status: string;
    dish_name?: string;
    restaurant_name?: string;
    tags?: string[] | null;
    cover_object_key?: string | null;
    cover_mime_type?: string | null;
    media_id?: string | null;
    updated_at?: Date;
  };
  type OptionRow = QueryResultRow & { id: string; label: string };

  const loadOptions = async () => {
    const [dishes, restaurants] = await Promise.all([
      dependencies.query<OptionRow>("select id, canonical_name as label from dishes where status <> 'archived' order by lower(canonical_name)"),
      dependencies.query<OptionRow>("select id, name as label from restaurants where status <> 'archived' order by lower(name)"),
    ]);
    return { dishes: dishes.rows, restaurants: restaurants.rows };
  };

  const renderForm = async (request: Request, row: FormValues, errors: FormErrors, editing = false, message?: string) => {
    const options = await loadOptions();
    const coverUrl = mediaUrl(row.cover_object_key);
    const body = `<section class="panel"><div class="panel-body">
      ${message ? `<div class="alert error" role="alert">${escapeHtml(message)}</div>` : ''}
      <form class="admin-form" method="post" enctype="multipart/form-data" action="${editing ? `/admin/versions/${attr(row.id)}` : '/admin/versions'}">
        <div class="form-grid">
          ${selectField({ name: 'dish_id', label: 'Dish', value: row.dish_id, options: [{ value: '', label: 'Choose a dish…' }, ...options.dishes.map((item) => ({ value: item.id, label: item.label }))], error: errors.dish_id, required: true })}
          ${selectField({ name: 'restaurant_id', label: 'Restaurant', value: row.restaurant_id, options: [{ value: '', label: 'Choose a restaurant…' }, ...options.restaurants.map((item) => ({ value: item.id, label: item.label }))], error: errors.restaurant_id, required: true })}
          ${inputField({ name: 'menu_name', label: 'Menu name', value: row.menu_name, error: errors.menu_name, full: true, hint: 'Leave blank when the menu uses the canonical dish name.' })}
          ${inputField({ name: 'listed_price', label: 'Listed price (AUD)', type: 'number', min: 0, max: 10000, step: '0.01', value: row.listed_price, error: errors.listed_price })}
          ${selectField({ name: 'status', label: 'Status', value: row.status ?? 'published', options: ['draft', 'published', 'archived'].map((value) => ({ value, label: value })) })}
          ${inputField({ name: 'tags', label: 'Tags', value: tagsForForm(row.tags), error: errors.tags, full: true, hint: 'Comma-separated, for example: Spicy, Big Portion, Near USYD.' })}
          ${textareaField({ name: 'description', label: 'Description', value: row.description, error: errors.description })}
          ${photoField(coverUrl)}
        </div>
        <div class="form-actions"><a class="button secondary" href="/admin/versions">Cancel</a><button class="button" type="submit">${editing ? 'Save version' : 'Create version'}</button></div>
      </form>
      ${editing ? `<div class="row-actions">${row.media_id ? `<form method="post" action="/admin/versions/${attr(row.id)}/photos/${attr(row.media_id)}/delete"><button class="button danger small" type="submit">Remove cover photo</button></form>` : ''}<form method="post" action="/admin/versions/${attr(row.id)}/archive"><button class="button danger small" type="submit">Archive version</button></form></div>` : ''}
    </div></section>`;
    return layout({ title: editing ? 'Edit version' : 'New version', active: 'versions', body, request: request as AdminRequest });
  };

  const syncTags = async (versionId: string, rawTags: string | null | undefined) => {
    const names = [...new Set(parseTags(rawTags).map((name) => name.slice(0, 80)))];
    await dependencies.query('delete from dish_version_tags where version_id=$1', [versionId]);
    for (const name of names) {
      const tag = await dependencies.query<{ id: string }>(`
        insert into tags (slug,name) values ($1,$2)
        on conflict (name) do update set name=excluded.name
        returning id
      `, [slugify(name), name]);
      if (tag.rows[0]) {
        await dependencies.query('insert into dish_version_tags (version_id,tag_id) values ($1,$2) on conflict do nothing', [versionId, tag.rows[0].id]);
      }
    }
  };

  const attachUpload = async (request: Request, versionId: string) => {
    if (!request.file) return;
    if (!dependencies.upload) throw new Error('R2 image uploads are not configured');
    const stored = await dependencies.upload(request.file, 'versions');
    const result = await dependencies.query<{ id: string }>(`
      insert into media
        (object_key,owner_user_id,purpose,status,mime_type,original_filename,byte_size,source,moderated_by,moderated_at)
      values ($1,$2,'version','approved',$3,$4,$5,'admin',$2,now()) returning id
    `, [stored.key, actorId(request), stored.mimeType, request.file.originalname, stored.bytes]);
    const mediaId = result.rows[0]?.id;
    if (!mediaId) throw new Error('Media insert did not return an id');
    await dependencies.query('update version_media set is_cover=false where version_id=$1', [versionId]);
    await dependencies.query(`insert into version_media (version_id,media_id,sort_order,is_cover)
      values ($1,$2,0,true)`, [versionId, mediaId]);
  };

  router.get('/versions', safeHandler(async (request, response) => {
    const search = text(request.query.q).trim();
    const result = await dependencies.query<VersionRow>(`
      select v.id,v.menu_name,v.listed_price,v.status,v.updated_at,
             d.canonical_name as dish_name,r.name as restaurant_name,
             cover.object_key as cover_object_key,cover.mime_type as cover_mime_type
      from dish_versions v
      join dishes d on d.id=v.dish_id
      join restaurants r on r.id=v.restaurant_id
      left join lateral (
        select m.object_key,m.mime_type
        from version_media vm
        join media m on m.id=vm.media_id
        where vm.version_id=v.id and m.status='approved'
        order by vm.is_cover desc,vm.sort_order,m.created_at,m.id
        limit 1
      ) cover on true
      where ($1='' or coalesce(v.menu_name,d.canonical_name) ilike '%'||$1||'%' or r.name ilike '%'||$1||'%')
      order by (v.status='archived'), lower(coalesce(v.menu_name,d.canonical_name)), lower(r.name)
      limit 300
    `, [search]);
    const rows = result.rows.map((row) => {
      const versionName = row.menu_name ?? row.dish_name ?? 'Dish version';
      const coverUrl = mediaUrl(row.cover_object_key);
      const browserPreviewable = ['image/jpeg', 'image/png', 'image/webp'].includes(text(row.cover_mime_type).toLowerCase());
      const thumbnail = coverUrl && browserPreviewable
        ? `<a class="version-thumbnail-link" href="/admin/versions/${attr(row.id)}" aria-label="Edit ${attr(versionName)}"><img class="version-thumbnail" src="${attr(coverUrl)}" alt="${attr(`${versionName} at ${row.restaurant_name ?? 'restaurant'}`)}" width="64" height="48" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>`
        : `<span class="version-thumbnail-placeholder" aria-label="${row.cover_object_key ? 'Photo preview unavailable' : 'No photo'}">${row.cover_object_key ? 'No preview' : 'No photo'}</span>`;
      return `<tr>
        <td class="thumbnail-cell" data-label="Photo">${thumbnail}</td>
        <td data-label="Version"><a class="entity-link" href="/admin/versions/${attr(row.id)}">${escapeHtml(versionName)}</a></td>
        <td data-label="Restaurant">${escapeHtml(row.restaurant_name)}</td>
        <td data-label="Dish">${escapeHtml(row.dish_name)}</td>
        <td data-label="Price">${escapeHtml(formatMoney(row.listed_price))}</td>
        <td data-label="Status">${statusBadge(row.status)}</td>
        <td class="actions-cell"><a class="button secondary small" href="/admin/versions/${attr(row.id)}">Edit</a></td>
      </tr>`;
    }).join('');
    const body = `<div class="toolbar"><form method="get" action="/admin/versions"><input class="field-control" type="search" name="q" value="${attr(search)}" placeholder="Search dish or restaurant"><button class="button secondary" type="submit">Search</button></form></div>
      <section class="panel">${rows ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Photo</th><th>Version</th><th>Restaurant</th><th>Dish</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">No versions found.</div>'}</section>`;
    response.type('html').send(layout({ title: 'Dish versions', active: 'versions', subtitle: `${result.rows.length} records`, body, request: request as AdminRequest, action: '<a class="button" href="/admin/versions/new">Add version</a>', alert: messageFromQuery(request) }));
  }));

  router.get('/versions/new', safeHandler(async (request, response) => {
    response.type('html').send(await renderForm(request, { status: 'published' }, {}));
  }));

  router.post('/versions', uploadMiddleware, safeHandler(async (request, response) => {
    const uploadError = (request as AdminRequest).adminUploadError;
    const parsed = versionSchema.safeParse(values(request));
    if (!parsed.success || uploadError) {
      const errors = parsed.success ? {} : errorsFromIssues(parsed.error.issues);
      response.status(400).type('html').send(await renderForm(request, values(request), errors, false, uploadError));
      return;
    }
    try {
      const data = parsed.data;
      const result = await dependencies.query<{ id: string }>(`
        insert into dish_versions
          (dish_id,restaurant_id,menu_name,description,listed_price,currency,status,source,created_by,published_at)
        values ($1,$2,$3,$4,$5,'AUD',$6,'admin',$7,case when $6='published' then now() else null end)
        returning id
      `, [data.dish_id, data.restaurant_id, data.menu_name, data.description, data.listed_price, data.status, actorId(request)]);
      const id = result.rows[0]?.id;
      if (!id) throw new Error('Version insert did not return an id');
      await syncTags(id, data.tags);
      await attachUpload(request, id);
      response.redirect(303, `/admin/versions/${id}?created=1`);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      response.status(409).type('html').send(await renderForm(request, values(request), {}, false, 'This dish already has a version at that restaurant.'));
    }
  }));

  router.get('/versions/:id', safeHandler(async (request, response) => {
    const result = await dependencies.query<VersionRow>(`
      select v.*, array_remove(array_agg(distinct t.name::text),null) as tags,
             cover.media_id, cover.object_key as cover_object_key
      from dish_versions v
      left join dish_version_tags vt on vt.version_id=v.id
      left join tags t on t.id=vt.tag_id
      left join lateral (
        select m.id as media_id,m.object_key from version_media vm join media m on m.id=vm.media_id
        where vm.version_id=v.id and m.status='approved' order by vm.is_cover desc,vm.sort_order limit 1
      ) cover on true
      where v.id=$1 group by v.id,cover.media_id,cover.object_key
    `, [request.params.id]);
    const row = result.rows[0];
    if (!row) { response.status(404).send('Version not found'); return; }
    response.type('html').send(await renderForm(request, row, {}, true));
  }));

  router.post('/versions/:id', uploadMiddleware, safeHandler(async (request, response) => {
    const uploadError = (request as AdminRequest).adminUploadError;
    const parsed = versionSchema.safeParse(values(request));
    if (!parsed.success || uploadError) {
      const errors = parsed.success ? {} : errorsFromIssues(parsed.error.issues);
      response.status(400).type('html').send(await renderForm(request, { id: request.params.id, ...values(request) }, errors, true, uploadError));
      return;
    }
    try {
      const data = parsed.data;
      const result = await dependencies.query<{ id: string }>(`
        update dish_versions set dish_id=$2,restaurant_id=$3,menu_name=$4,description=$5,listed_price=$6,status=$7,
          published_at=case when $7='published' then coalesce(published_at,now()) else published_at end
        where id=$1 returning id
      `, [request.params.id, data.dish_id, data.restaurant_id, data.menu_name, data.description, data.listed_price, data.status]);
      if (!result.rows[0]) { response.status(404).send('Version not found'); return; }
      await syncTags(routeParam(request, 'id'), data.tags);
      await attachUpload(request, routeParam(request, 'id'));
      response.redirect(303, `/admin/versions/${request.params.id}?saved=1`);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      response.status(409).type('html').send(await renderForm(request, { id: request.params.id, ...values(request) }, {}, true, 'This dish already has a version at that restaurant.'));
    }
  }));

  router.post('/versions/:id/photos/:mediaId/delete', safeHandler(async (request, response) => {
    await dependencies.query(`with removed as (
      delete from version_media where version_id=$1 and media_id=$2 returning media_id
    ) update media set status='hidden',moderated_by=$3,moderated_at=now()
      where id in (select media_id from removed)`, [request.params.id, request.params.mediaId, actorId(request)]);
    response.redirect(303, `/admin/versions/${request.params.id}?saved=1`);
  }));

  router.post('/versions/:id/archive', safeHandler(async (request, response) => {
    await dependencies.query("update dish_versions set status='archived' where id=$1", [request.params.id]);
    response.redirect(303, '/admin/versions?archived=1');
  }));
}
function registerContributions(router: Router, dependencies: AdminDependencies): void {
  type ContributionRow = QueryResultRow & {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    dish_id: string;
    dish_name: string;
    restaurant_id: string | null;
    restaurant_name: string | null;
    proposed_restaurant_name: string | null;
    proposed_restaurant_address: string | null;
    proposed_menu_name: string | null;
    price_paid: string | number | null;
    would_eat_again: boolean | null;
    notes: string | null;
    status: string;
    rejection_reason: string | null;
    resulting_version_id: string | null;
    object_key: string | null;
    created_at: Date;
    reviewed_at: Date | null;
  };
  type RestaurantOption = QueryResultRow & { id: string; name: string };

  router.get('/contributions', safeHandler(async (request, response) => {
    const requestedStatus = text(request.query.status);
    const filter = ['pending', 'approved', 'rejected'].includes(requestedStatus) ? requestedStatus : '';
    const result = await dependencies.query<ContributionRow>(`
      select c.id,c.status,c.proposed_menu_name,c.price_paid,c.created_at,
             u.display_name as user_name,u.email::text as user_email,
             d.canonical_name as dish_name,
             coalesce(r.name,c.proposed_restaurant_name) as restaurant_name
      from contributions c
      join users u on u.id=c.user_id join dishes d on d.id=c.dish_id
      left join restaurants r on r.id=c.restaurant_id
      where ($1='' or c.status=$1)
      order by case c.status when 'pending' then 0 when 'approved' then 1 else 2 end,c.created_at asc
      limit 300
    `, [filter]);
    const rows = result.rows.map((row) => `<tr>
      <td data-label="Contribution"><a class="entity-link" href="/admin/contributions/${attr(row.id)}">${escapeHtml(row.proposed_menu_name ?? row.dish_name)}</a></td>
      <td data-label="Restaurant">${escapeHtml(row.restaurant_name ?? 'New restaurant')}</td>
      <td data-label="Submitted by">${escapeHtml(row.user_name)}</td>
      <td data-label="Price">${escapeHtml(formatMoney(row.price_paid))}</td>
      <td data-label="Status">${statusBadge(row.status)}</td>
      <td data-label="Submitted">${escapeHtml(formatDate(row.created_at))}</td>
      <td class="actions-cell"><a class="button secondary small" href="/admin/contributions/${attr(row.id)}">Review</a></td>
    </tr>`).join('');
    const statusOptions = ['', 'pending', 'approved', 'rejected'].map((status) => `<option value="${attr(status)}"${status === filter ? ' selected' : ''}>${escapeHtml(status || 'All statuses')}</option>`).join('');
    const body = `<div class="toolbar"><form method="get" action="/admin/contributions"><select class="field-control" name="status">${statusOptions}</select><button class="button secondary" type="submit">Filter</button></form></div>
      <section class="panel">${rows ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Contribution</th><th>Restaurant</th><th>Submitted by</th><th>Price</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">No contributions in this queue.</div>'}</section>`;
    response.type('html').send(layout({ title: 'Contributions', active: 'contributions', subtitle: `${result.rows.length} submissions`, body, request: request as AdminRequest, alert: messageFromQuery(request) }));
  }));

  router.get('/contributions/:id', safeHandler(async (request, response) => {
    const [result, restaurants] = await Promise.all([
      dependencies.query<ContributionRow>(`
        select c.*,u.display_name as user_name,u.email::text as user_email,d.canonical_name as dish_name,
               r.name as restaurant_name,photo.object_key
        from contributions c join users u on u.id=c.user_id join dishes d on d.id=c.dish_id
        left join restaurants r on r.id=c.restaurant_id
        left join lateral (
          select m.object_key from contribution_media cm join media m on m.id=cm.media_id
          where cm.contribution_id=c.id order by cm.sort_order limit 1
        ) photo on true
        where c.id=$1
      `, [request.params.id]),
      dependencies.query<RestaurantOption>("select id,name from restaurants where status <> 'archived' order by lower(name)"),
    ]);
    const row = result.rows[0];
    if (!row) { response.status(404).send('Contribution not found'); return; }
    const photo = mediaUrl(row.object_key);
    const pendingActions = row.status === 'pending' ? `<div class="moderation-grid">
      <form class="admin-form panel" method="post" action="/admin/contributions/${attr(row.id)}/approve"><div class="panel-body">
        <h2>Approve and publish</h2>
        <div class="form-grid">
          ${selectField({ name: 'restaurant_id', label: 'Restaurant', value: row.restaurant_id, options: [{ value: '', label: 'Choose an existing restaurant…' }, ...restaurants.rows.map((item) => ({ value: item.id, label: item.name }))], required: true, full: true })}
          ${inputField({ name: 'menu_name', label: 'Menu name', value: row.proposed_menu_name, full: true })}
          ${inputField({ name: 'listed_price', label: 'Listed price (AUD)', value: row.price_paid, type: 'number', min: 0, max: 10000, step: '0.01', full: true })}
        </div>
        ${row.restaurant_id == null ? '<p class="field-hint">If this is a new restaurant, create it first, then return here and select it.</p>' : ''}
        <div class="form-actions"><button class="button" type="submit">Approve contribution</button></div>
      </div></form>
      <form class="admin-form panel" method="post" action="/admin/contributions/${attr(row.id)}/reject"><div class="panel-body">
        <h2>Reject</h2>
        ${textareaField({ name: 'rejection_reason', label: 'Reason shown to contributor', full: true })}
        <div class="form-actions"><button class="button danger" type="submit">Reject contribution</button></div>
      </div></form>
    </div>` : `<section class="panel"><div class="panel-body"><h2>Moderation result</h2><p>${statusBadge(row.status)} ${row.reviewed_at ? `on ${escapeHtml(formatDate(row.reviewed_at))}` : ''}</p>${row.rejection_reason ? `<p>${escapeHtml(row.rejection_reason)}</p>` : ''}${row.resulting_version_id ? `<a class="button secondary" href="/admin/versions/${attr(row.resulting_version_id)}">Open resulting version</a>` : ''}</div></section>`;
    const body = `<section class="panel"><div class="panel-body"><div class="moderation-grid">
      <div>${photo ? `<img class="moderation-photo" src="${attr(photo)}" alt="Submitted dish">` : '<div class="empty">No photo submitted.</div>'}</div>
      <dl class="detail-list">
        <dt>Status</dt><dd>${statusBadge(row.status)}</dd>
        <dt>Submitted by</dt><dd>${escapeHtml(row.user_name)} · ${escapeHtml(row.user_email)}</dd>
        <dt>Dish</dt><dd>${escapeHtml(row.dish_name)}</dd>
        <dt>Restaurant</dt><dd>${escapeHtml(row.restaurant_name ?? row.proposed_restaurant_name ?? '—')}</dd>
        <dt>Proposed address</dt><dd>${escapeHtml(row.proposed_restaurant_address ?? '—')}</dd>
        <dt>Menu name</dt><dd>${escapeHtml(row.proposed_menu_name ?? row.dish_name)}</dd>
        <dt>Price</dt><dd>${escapeHtml(formatMoney(row.price_paid))}</dd>
        <dt>Would eat again</dt><dd>${row.would_eat_again == null ? 'Not part of this contribution' : row.would_eat_again ? 'Yes' : 'No'}</dd>
        <dt>Notes</dt><dd>${escapeHtml(row.notes ?? '—')}</dd>
        <dt>Submitted</dt><dd>${escapeHtml(formatDate(row.created_at))}</dd>
      </dl>
    </div></div></section>${pendingActions}`;
    response.type('html').send(layout({ title: row.proposed_menu_name ?? row.dish_name, active: 'contributions', subtitle: 'Contribution review', body, request: request as AdminRequest, alert: messageFromQuery(request), action: '<a class="button secondary" href="/admin/contributions">Back to queue</a>' }));
  }));

  router.post('/contributions/:id/approve', safeHandler(async (request, response) => {
    const parsed = contributionApprovalSchema.safeParse(values(request));
    if (!parsed.success) {
      response.status(400).type('html').send(layout({ title: 'Cannot approve', active: 'contributions', body: `<div class="alert error">${escapeHtml(parsed.error.issues[0]?.message ?? 'Invalid approval details')}</div><a class="button secondary" href="/admin/contributions/${attr(request.params.id)}">Return to contribution</a>`, request: request as AdminRequest }));
      return;
    }
    const data = parsed.data;
    const result = await dependencies.query<{ version_id: string }>(`
      with source as (
        select c.*,u.display_name from contributions c join users u on u.id=c.user_id
        where c.id=$1 and c.status='pending'
        for update of c
      ), upserted as (
        insert into dish_versions (dish_id,restaurant_id,menu_name,listed_price,currency,status,source,created_by,published_at)
        select dish_id,$2,$3,coalesce($4,price_paid),'AUD','published','contribution',$5,now() from source
        on conflict (dish_id,restaurant_id) do update set
          menu_name=coalesce(excluded.menu_name,dish_versions.menu_name),
          listed_price=coalesce(excluded.listed_price,dish_versions.listed_price),
          status='published',published_at=coalesce(dish_versions.published_at,now())
        returning id
      ), reviewed as (
        update contributions c set status='approved',resulting_version_id=v.id,reviewed_by=$5,reviewed_at=now(),rejection_reason=null
        from source s,upserted v where c.id=s.id and c.status='pending'
        returning c.user_id,c.dish_id,c.would_eat_again,c.notes,c.price_paid,v.id as version_id
      ), published_dish as (
        update dishes d set status='published',published_at=coalesce(d.published_at,now())
        from reviewed where d.id=reviewed.dish_id returning d.id
      ), published_restaurant as (
        update restaurants r set status='published',published_at=coalesce(r.published_at,now())
        from reviewed where r.id=$2 and r.status <> 'published' returning r.id
      ), approved_media as (
        update media m set status='approved',moderated_by=$5,moderated_at=now()
        from reviewed
        where m.id in (select cm.media_id from contribution_media cm where cm.contribution_id=$1)
        returning id
      ), linked_media as (
        insert into version_media (version_id,media_id,sort_order,is_cover)
        select reviewed.version_id,cm.media_id,cm.sort_order,false from reviewed
        join contribution_media cm on cm.contribution_id=$1
        on conflict do nothing returning media_id
      ), published_review as (
        insert into reviews (version_id,user_id,author_name_snapshot,would_eat_again,body,price_paid,status,source)
        select reviewed.version_id,s.user_id,s.display_name,reviewed.would_eat_again,reviewed.notes,reviewed.price_paid,'published','contribution'
        from reviewed join source s on true where reviewed.would_eat_again is not null
        on conflict (version_id,user_id) where user_id is not null do nothing
        returning id
      ), notified as (
        insert into notifications (user_id,type,title,body,contribution_id,version_id)
        select user_id,'contribution_approved','Your contribution was approved','Your dish version is now live on Dish.', $1,version_id from reviewed
        returning id
      ) select version_id from reviewed
    `, [request.params.id, data.restaurant_id, data.menu_name, data.listed_price, actorId(request)]);
    if (!result.rows[0]) {
      response.status(409).type('html').send(layout({ title: 'Already reviewed', active: 'contributions', body: '<div class="alert error">This contribution is no longer pending.</div><a class="button secondary" href="/admin/contributions">Return to queue</a>', request: request as AdminRequest }));
      return;
    }
    response.redirect(303, `/admin/contributions/${request.params.id}?approved=1`);
  }));

  router.post('/contributions/:id/reject', safeHandler(async (request, response) => {
    const parsed = contributionRejectionSchema.safeParse(values(request));
    if (!parsed.success) {
      response.status(400).type('html').send(layout({ title: 'Cannot reject', active: 'contributions', body: `<div class="alert error">${escapeHtml(parsed.error.issues[0]?.message ?? 'A reason is required')}</div><a class="button secondary" href="/admin/contributions/${attr(request.params.id)}">Return to contribution</a>`, request: request as AdminRequest }));
      return;
    }
    const result = await dependencies.query<{ id: string }>(`
      with reviewed as (
        update contributions set status='rejected',reviewed_by=$2,reviewed_at=now(),rejection_reason=$3
        where id=$1 and status='pending' returning id,user_id
      ), rejected_media as (
        update media set status='rejected',moderated_by=$2,moderated_at=now()
        from reviewed
        where media.id in (select media_id from contribution_media where contribution_id=$1)
      ), notified as (
        insert into notifications (user_id,type,title,body,contribution_id)
        select user_id,'contribution_rejected','Contribution needs changes',$3,id from reviewed
      ) select id from reviewed
    `, [request.params.id, actorId(request), parsed.data.rejection_reason]);
    if (!result.rows[0]) { response.status(409).send('This contribution is no longer pending.'); return; }
    response.redirect(303, `/admin/contributions/${request.params.id}?rejected=1`);
  }));
}
function registerReviews(router: Router, dependencies: AdminDependencies): void {
  type ReviewRow = QueryResultRow & {
    id: string;
    author_name_snapshot: string;
    user_email: string | null;
    would_eat_again: boolean;
    body: string | null;
    price_paid: string | number | null;
    status: string;
    created_at: Date;
    dish_name: string;
    menu_name: string | null;
    restaurant_name: string;
    object_key: string | null;
  };

  router.get('/reviews', safeHandler(async (request, response) => {
    const requestedStatus = text(request.query.status);
    const filter = ['published', 'hidden'].includes(requestedStatus) ? requestedStatus : '';
    const search = text(request.query.q).trim();
    const result = await dependencies.query<ReviewRow>(`
      select rv.id,rv.author_name_snapshot,u.email::text as user_email,rv.would_eat_again,rv.body,
             rv.price_paid,rv.status,rv.created_at,d.canonical_name as dish_name,v.menu_name,
             r.name as restaurant_name,photo.object_key
      from reviews rv join dish_versions v on v.id=rv.version_id join dishes d on d.id=v.dish_id
      join restaurants r on r.id=v.restaurant_id left join users u on u.id=rv.user_id
      left join lateral (
        select m.object_key from review_media rm join media m on m.id=rm.media_id
        where rm.review_id=rv.id order by rm.sort_order limit 1
      ) photo on true
      where ($1='' or rv.status=$1)
        and ($2='' or rv.author_name_snapshot ilike '%'||$2||'%' or d.canonical_name ilike '%'||$2||'%' or r.name ilike '%'||$2||'%')
      order by rv.created_at desc limit 300
    `, [filter, search]);
    const cards = result.rows.map((row) => {
      const photo = mediaUrl(row.object_key);
      const nextAction = row.status === 'published'
        ? `<form method="post" action="/admin/reviews/${attr(row.id)}/hide"><button class="button danger small" type="submit">Hide</button></form>`
        : `<form method="post" action="/admin/reviews/${attr(row.id)}/publish"><button class="button small" type="submit">Publish</button></form>`;
      return `<article class="panel"><div class="panel-body"><div class="moderation-grid">
        <div>${photo ? `<img class="moderation-photo" src="${attr(photo)}" alt="Review photo">` : `<div><span class="badge ${row.would_eat_again ? 'approved' : 'rejected'}">${row.would_eat_again ? 'Would eat again' : 'Would not eat again'}</span></div>`}</div>
        <div>
          <div class="section-heading"><div><h2>${escapeHtml(row.menu_name ?? row.dish_name)}</h2><p class="subtitle">${escapeHtml(row.restaurant_name)}</p></div>${statusBadge(row.status)}</div>
          <p>${escapeHtml(row.body ?? 'No written review.')}</p>
          <p class="subtitle">${escapeHtml(row.author_name_snapshot)}${row.user_email ? ` · ${escapeHtml(row.user_email)}` : ''} · ${escapeHtml(formatDate(row.created_at))} · ${escapeHtml(formatMoney(row.price_paid))}</p>
          <div class="row-actions" style="margin-top:14px">${nextAction}</div>
        </div>
      </div></div></article>`;
    }).join('');
    const statusOptions = ['', 'published', 'hidden'].map((status) => `<option value="${attr(status)}"${status === filter ? ' selected' : ''}>${escapeHtml(status || 'All statuses')}</option>`).join('');
    const body = `<div class="toolbar"><form method="get" action="/admin/reviews"><input class="field-control" type="search" name="q" value="${attr(search)}" placeholder="Search author, dish or restaurant"><select class="field-control" name="status">${statusOptions}</select><button class="button secondary" type="submit">Filter</button></form></div>${cards || '<section class="panel"><div class="empty">No reviews found.</div></section>'}`;
    response.type('html').send(layout({ title: 'Reviews', active: 'reviews', subtitle: `${result.rows.length} reviews`, body, request: request as AdminRequest, alert: messageFromQuery(request) }));
  }));

  router.post('/reviews/:id/publish', safeHandler(async (request, response) => {
    await dependencies.query("update reviews set status='published' where id=$1", [request.params.id]);
    await dependencies.query(`update media set status='approved',moderated_by=$2,moderated_at=now()
      where id in (select media_id from review_media where review_id=$1)`, [request.params.id, actorId(request)]);
    response.redirect(303, '/admin/reviews?saved=1');
  }));

  router.post('/reviews/:id/hide', safeHandler(async (request, response) => {
    await dependencies.query("update reviews set status='hidden' where id=$1", [request.params.id]);
    await dependencies.query(`update media set status='hidden',moderated_by=$2,moderated_at=now()
      where id in (select media_id from review_media where review_id=$1)`, [request.params.id, actorId(request)]);
    response.redirect(303, '/admin/reviews?saved=1');
  }));
}
function registerUsers(router: Router, dependencies: AdminDependencies): void {
  type UserRow = QueryResultRow & {
    id: string;
    email: string;
    display_name: string;
    campus: string | null;
    role: string;
    status: string;
    created_at: Date;
    last_login_at: Date | null;
    review_count: number;
    contribution_count: number;
  };

  const renderNew = (request: Request, row: FormValues, errors: FormErrors, message?: string) => {
    const body = `<section class="panel"><div class="panel-body">
      ${message ? `<div class="alert error" role="alert">${escapeHtml(message)}</div>` : ''}
      <form class="admin-form" method="post" action="/admin/users">
        <div class="form-grid">
          ${inputField({ name: 'display_name', label: 'Display name', value: row.display_name, error: errors.display_name, required: true })}
          ${inputField({ name: 'email', label: 'Email', type: 'email', value: row.email, error: errors.email, required: true })}
          ${inputField({ name: 'campus', label: 'Campus / area', value: row.campus, error: errors.campus })}
          ${selectField({ name: 'status', label: 'Status', value: row.status ?? 'active', options: ['active', 'suspended'].map((value) => ({ value, label: value })) })}
          ${inputField({ name: 'password', label: 'Temporary password', type: 'password', error: errors.password, required: true, full: true, hint: 'At least 8 characters. The password is never displayed again.' })}
        </div>
        <div class="form-actions"><a class="button secondary" href="/admin/users">Cancel</a><button class="button" type="submit">Create user</button></div>
      </form>
    </div></section>`;
    return layout({ title: 'New user', active: 'users', subtitle: 'Creates a normal member account.', body, request: request as AdminRequest });
  };

  router.get('/users', safeHandler(async (request, response) => {
    const search = text(request.query.q).trim();
    const result = await dependencies.query<UserRow>(`
      select u.id,u.email::text as email,u.display_name,u.campus,u.role,u.status,u.created_at,u.last_login_at,
             count(distinct rv.id)::int as review_count,count(distinct c.id)::int as contribution_count
      from users u left join reviews rv on rv.user_id=u.id left join contributions c on c.user_id=u.id
      where ($1='' or u.display_name ilike '%'||$1||'%' or u.email::text ilike '%'||$1||'%')
      group by u.id order by (u.role='admin') desc,(u.status='suspended'),lower(u.display_name) limit 300
    `, [search]);
    const currentUserId = actorId(request);
    const rows = result.rows.map((row) => {
      const canChange = row.id !== currentUserId;
      const nextStatus = row.status === 'active' ? 'suspended' : 'active';
      return `<tr>
        <td data-label="User"><strong>${escapeHtml(row.display_name)}</strong><br><span class="subtitle">${escapeHtml(row.email)}</span></td>
        <td data-label="Campus">${escapeHtml(row.campus ?? '—')}</td>
        <td data-label="Role">${statusBadge(row.role)}</td>
        <td data-label="Status">${statusBadge(row.status)}</td>
        <td data-label="Reviews">${escapeHtml(row.review_count)}</td>
        <td data-label="Contributions">${escapeHtml(row.contribution_count)}</td>
        <td class="actions-cell">${canChange ? `<form method="post" action="/admin/users/${attr(row.id)}/status"><input type="hidden" name="status" value="${attr(nextStatus)}"><button class="button ${nextStatus === 'suspended' ? 'danger' : 'secondary'} small" type="submit">${nextStatus === 'suspended' ? 'Suspend' : 'Reactivate'}</button></form>` : '<span class="subtitle">Current user</span>'}</td>
      </tr>`;
    }).join('');
    const body = `<div class="toolbar"><form method="get" action="/admin/users"><input class="field-control" type="search" name="q" value="${attr(search)}" placeholder="Search name or email"><button class="button secondary" type="submit">Search</button></form></div>
      <section class="panel">${rows ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>User</th><th>Campus</th><th>Role</th><th>Status</th><th>Reviews</th><th>Contributions</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">No users found.</div>'}</section>`;
    response.type('html').send(layout({ title: 'Users', active: 'users', subtitle: `${result.rows.length} accounts`, body, request: request as AdminRequest, action: '<a class="button" href="/admin/users/new">Add user</a>', alert: messageFromQuery(request) }));
  }));

  router.get('/users/new', (request, response) => {
    response.type('html').send(renderNew(request, { status: 'active' }, {}));
  });

  router.post('/users', safeHandler(async (request, response) => {
    const parsed = userSchema.safeParse(values(request));
    if (!parsed.success) {
      response.status(400).type('html').send(renderNew(request, values(request), errorsFromIssues(parsed.error.issues)));
      return;
    }
    if (!dependencies.auth?.hashPassword) {
      response.status(503).type('html').send(renderNew(request, { ...values(request), password: '' }, {}, 'Password hashing is not configured.'));
      return;
    }
    try {
      const data = parsed.data;
      const passwordHash = await dependencies.auth.hashPassword(data.password);
      await dependencies.query(`insert into users (email,password_hash,display_name,campus,role,status)
        values ($1,$2,$3,$4,'user',$5)`, [data.email, passwordHash, data.display_name, data.campus, data.status]);
      response.redirect(303, '/admin/users?created=1');
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      response.status(409).type('html').send(renderNew(request, { ...values(request), password: '' }, {}, 'An account with this email already exists.'));
    }
  }));

  router.post('/users/:id/status', safeHandler(async (request, response) => {
    const status = z.enum(['active', 'suspended']).safeParse(values(request).status);
    if (!status.success) { response.status(400).send('Invalid user status'); return; }
    const targetId = routeParam(request, 'id');
    if (targetId === actorId(request)) { response.status(400).send('You cannot suspend your own administrator account.'); return; }
    await dependencies.query('update users set status=$2 where id=$1', [targetId, status.data]);
    if (status.data === 'suspended') {
      await dependencies.query('update sessions set revoked_at=coalesce(revoked_at,now()) where user_id=$1 and revoked_at is null', [targetId]);
    }
    response.redirect(303, '/admin/users?saved=1');
  }));
}
