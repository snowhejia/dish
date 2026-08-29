import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { query } from './db';

export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  campus: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
};

export type AuthSession = {
  id: string;
  expiresAt: Date;
};

export type CreatedSession = AuthSession & {
  token: string;
};

export type SessionMeta = {
  ip?: string | null;
  userAgent?: string | null;
  ttlMs?: number;
};

export type AuthenticatedRequest = Request & {
  user: AuthUser;
  session: AuthSession;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      session?: AuthSession;
    }
  }
}

type SessionRow = {
  session_id: string;
  expires_at: Date;
  user_id: string;
  email: string;
  display_name: string;
  campus: string | null;
  role: UserRole;
  status: UserStatus;
  user_created_at: Date;
};

const PASSWORD_SCHEME = 'scrypt';
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const SESSION_BYTES = 32;
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

export const SESSION_COOKIE_NAME = 'dish_session';

export async function hashPassword(password: string): Promise<string> {
  assertPasswordInput(password);
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY,
  });
  return [
    PASSWORD_SCHEME,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  if (!password || Buffer.byteLength(password, 'utf8') > 1_024) return false;

  const parts = encodedHash.split('$');
  if (parts.length !== 6 || parts[0] !== PASSWORD_SCHEME) return false;

  const n = Number.parseInt(parts[1] ?? '', 10);
  const r = Number.parseInt(parts[2] ?? '', 10);
  const p = Number.parseInt(parts[3] ?? '', 10);
  if (!isSafeScryptCost(n, r, p)) return false;

  try {
    const salt = Buffer.from(parts[4] ?? '', 'base64url');
    const expected = Buffer.from(parts[5] ?? '', 'base64url');
    if (salt.length < 16 || expected.length !== SCRYPT_KEY_LENGTH) return false;

    const actual = await scrypt(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: SCRYPT_MAX_MEMORY,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function createSession(
  userId: string,
  meta: SessionMeta = {},
): Promise<CreatedSession> {
  const ttlMs = normalizeSessionTtl(meta.ttlMs);
  const token = randomBytes(SESSION_BYTES).toString('base64url');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);

  const result = await query<{ id: string }>(
    `
      INSERT INTO sessions (user_id, token_hash, expires_at, ip, user_agent)
      SELECT id, $2, $3, $4, $5
      FROM users
      WHERE id = $1
        AND status = 'active'
      RETURNING id
    `,
    [
      userId,
      tokenHash,
      expiresAt,
      normalizeIp(meta.ip),
      meta.userAgent?.slice(0, 1_000) ?? null,
    ],
  );

  const row = result.rows[0];
  if (!row) throw new Error('Cannot create a session for an unknown or disabled user');
  return { id: row.id, token, expiresAt };
}

export async function clearSession(token: string): Promise<void> {
  if (!isPlausibleSessionToken(token)) return;
  await query(
    `
      UPDATE sessions
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE token_hash = $1
    `,
    [hashSessionToken(token)],
  );
}

export async function clearUserSessions(userId: string): Promise<void> {
  await query(
    `
      UPDATE sessions
      SET revoked_at = COALESCE(revoked_at, now())
      WHERE user_id = $1
        AND revoked_at IS NULL
    `,
    [userId],
  );
}

export function getSessionToken(req: Request): string | undefined {
  const authorization = req.get('authorization');
  if (authorization) {
    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (match?.[1] && isPlausibleSessionToken(match[1])) return match[1];
  }

  const cookieToken = parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME];
  return cookieToken && isPlausibleSessionToken(cookieToken) ? cookieToken : undefined;
}

export async function authenticateRequest(req: Request): Promise<AuthUser | null> {
  const token = getSessionToken(req);
  if (!token) return null;

  const result = await query<SessionRow>(
    `
      SELECT
        s.id AS session_id,
        s.expires_at,
        u.id AS user_id,
        u.email::text AS email,
        u.display_name,
        u.campus,
        u.role,
        u.status,
        u.created_at AS user_created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.status = 'active'
      LIMIT 1
    `,
    [hashSessionToken(token)],
  );

  const row = result.rows[0];
  if (!row) return null;

  req.user = mapAuthUser(row);
  req.session = { id: row.session_id, expiresAt: row.expires_at };

  // Avoid a write on every authenticated request while retaining useful
  // session activity data for account/security screens.
  await query(
    `
      UPDATE sessions
      SET last_seen_at = now()
      WHERE id = $1
        AND last_seen_at < now() - interval '5 minutes'
    `,
    [row.session_id],
  );

  return req.user;
}

export const optionalAuth: RequestHandler = async (req, res, next) => {
  try {
    await authenticateRequest(req);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireUser: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user ?? await authenticateRequest(req);
    if (!user) {
      sendAuthError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    const user = req.user ?? await authenticateRequest(req);
    if (!user) {
      if (isAdminHtmlRequest(req)) {
        res.redirect(303, '/admin/login');
        return;
      }
      sendAuthError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }
    if (user.role !== 'admin') {
      if (isAdminHtmlRequest(req)) {
        sendAdminAccessDenied(res);
        return;
      }
      sendAuthError(res, 403, 'FORBIDDEN', 'Administrator access required');
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

function mapAuthUser(row: SessionRow): AuthUser {
  return {
    id: row.user_id,
    email: row.email,
    displayName: row.display_name,
    campus: row.campus,
    role: row.role,
    status: row.status,
    createdAt: row.user_created_at,
  };
}

function sendAuthError(
  res: Response,
  status: 401 | 403,
  code: 'UNAUTHORIZED' | 'FORBIDDEN',
  message: string,
): void {
  res.status(status).json({ error: { code, message } });
}

function isAdminHtmlRequest(req: Request): boolean {
  const url = req.originalUrl || req.url;
  return url.startsWith('/admin') && Boolean(req.accepts('html'));
}

function sendAdminAccessDenied(res: Response): void {
  res.status(403).type('html').send(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex,nofollow">
        <title>Administrator access required · Dish.</title>
        <link rel="stylesheet" href="/admin/admin.css">
      </head>
      <body class="auth-page">
        <main class="auth-card">
          <div class="auth-brand">DISH. ADMIN</div>
          <h1>Administrator access required</h1>
          <p class="subtitle">This account is signed in as a normal user.</p>
          <a class="button" href="/admin/login">Sign in with an admin account</a>
        </main>
      </body>
    </html>`);
}

function assertPasswordInput(password: string): void {
  const bytes = Buffer.byteLength(password, 'utf8');
  if (bytes === 0 || bytes > 1_024) {
    throw new Error('Password must contain between 1 and 1024 UTF-8 bytes');
  }
}

function isSafeScryptCost(n: number, r: number, p: number): boolean {
  return Number.isSafeInteger(n)
    && n >= 1_024
    && n <= 65_536
    && (n & (n - 1)) === 0
    && Number.isSafeInteger(r)
    && r >= 1
    && r <= 32
    && Number.isSafeInteger(p)
    && p >= 1
    && p <= 8;
}

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function normalizeSessionTtl(ttlMs?: number): number {
  const fromEnvironment = Number.parseInt(process.env.SESSION_TTL_DAYS ?? '', 10);
  const configured = Number.isSafeInteger(fromEnvironment) && fromEnvironment > 0
    ? fromEnvironment * 24 * 60 * 60 * 1_000
    : DEFAULT_SESSION_TTL_MS;
  const requested = ttlMs ?? configured;
  const minimum = 5 * 60 * 1_000;
  const maximum = 365 * 24 * 60 * 60 * 1_000;
  return Math.min(maximum, Math.max(minimum, requested));
}

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function isPlausibleSessionToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{40,128}$/.test(token);
}

function normalizeIp(ip?: string | null): string | null {
  if (!ip) return null;
  const first = ip.split(',')[0]?.trim();
  if (!first) return null;
  return first.startsWith('::ffff:') ? first.slice(7) : first;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      // Ignore malformed cookie values instead of failing every request.
    }
  }
  return cookies;
}

// Compatibility aliases for callers written against the earlier plan.
export const revokeSession = clearSession;
export const requireAuth = requireUser;
