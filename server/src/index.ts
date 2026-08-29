import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';

import {
  SESSION_COOKIE_NAME,
  clearSession,
  clearSessionCookie,
  createSession,
  getSessionToken,
  hashPassword,
  requireAdmin,
  setSessionCookie,
  verifyPassword,
} from './auth';
import { createAdminRouter } from './admin';
import { createApiRouter } from './api';
import { closeDb, ensureSchema, query } from './db';
import { seedDatabase } from './seed';
import { uploadBundledSeedMedia } from './seedMedia';
import { uploadImage } from './storage';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (request.path.startsWith('/admin')) {
      response.setHeader('Cache-Control', 'no-store');
    }
    next();
  });
  app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins().includes(origin)) callback(null, true);
      else callback(null, false);
    },
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.get('/api/health', async (_request, response, next) => {
    try {
      await query('SELECT 1');
      response.json({ ok: true, database: 'connected', storage: process.env.R2_BUCKET ? 'configured' : 'not_configured' });
    } catch (error) {
      next(error);
    }
  });
  app.use('/api/v1', createApiRouter());

  app.use('/admin', createAdminRouter({
    query: (text, values = []) => query(text, [...values]),
    requireAdmin,
    auth: {
      verifyPassword,
      hashPassword,
      createSession,
      setSessionCookie,
      clearSessionCookie,
      clearSession,
      sessionCookieName: SESSION_COOKIE_NAME,
    },
    upload: uploadImage,
  }));

  app.get('/', (_request, response) => response.redirect(302, '/admin'));
  app.use((request, response) => {
    if (request.path.startsWith('/api/')) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
    } else {
      response.status(404).type('text').send('Not found');
    }
  });
  app.use(errorHandler);
  return app;
}

async function start() {
  await ensureSchema();
  if (process.env.SEED_ON_START === 'true') {
    if (process.env.SEED_UPLOAD_MEDIA === 'true') {
      console.log('[seed-media] ready', await uploadBundledSeedMedia());
    }
    const summary = await seedDatabase({ includeMedia: process.env.SEED_UPLOAD_MEDIA === 'true' });
    console.log('[seed] ready', summary);
  }
  await bootstrapAdmin();

  const port = positiveInteger(process.env.PORT, 3000);
  const app = createApp();
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[server] Dish API and admin listening on port ${port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[server] ${signal}; closing`);
    server.close(() => {
      void closeDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || 'Dish Admin';
  if (!email && !password) {
    const admins = await query<{ count: string }>("SELECT count(*)::text AS count FROM users WHERE role = 'admin' AND status = 'active'");
    if (Number(admins.rows[0]?.count ?? 0) === 0) {
      console.warn('[auth] No active admin exists. Set ADMIN_EMAIL and ADMIN_PASSWORD, then redeploy.');
    }
    return;
  }
  if (!email || !password || password.length < 8) {
    throw new Error('ADMIN_EMAIL and an ADMIN_PASSWORD of at least 8 characters must be set together');
  }
  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO users (email, password_hash, display_name, role, status)
     VALUES ($1, $2, $3, 'admin', 'active')
     ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name,
         role = 'admin',
         status = 'active'`,
    [email, passwordHash, displayName],
  );
}

function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
  const requestId = request.get('x-request-id') ?? randomUUID();
  console.error(`[request:${requestId}]`, error);

  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.issues[0]?.message ?? 'Invalid request.',
        fields: error.flatten().fieldErrors,
      },
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    response.status(400).json({ error: { code: 'UPLOAD_ERROR', message: error.message } });
    return;
  }

  const typed = error as { code?: string; status?: number; message?: string; constraint?: string };
  if (typed.code === '23505') {
    response.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'That record already exists.' } });
    return;
  }
  const status = Number.isInteger(typed.status) && typed.status! >= 400 && typed.status! < 600 ? typed.status! : 500;
  response.status(status).json({
    error: {
      code: typed.code && !/^\d{5}$/.test(typed.code) ? typed.code : 'INTERNAL_ERROR',
      message: status < 500 ? typed.message ?? 'Request failed.' : 'The server could not complete this request.',
      requestId,
    },
  });
}

function allowedOrigins() {
  const configured = [process.env.APP_ORIGIN, process.env.ADMIN_ORIGIN]
    .flatMap((value) => value?.split(',') ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV !== 'production') {
    configured.push('http://localhost:8081', 'http://localhost:19006', 'http://127.0.0.1:8081');
  }
  return configured;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

if (require.main === module) {
  void start().catch((error) => {
    console.error('[server] startup failed', error);
    process.exitCode = 1;
  });
}
