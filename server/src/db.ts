import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

const databaseUrl = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString: databaseUrl,
  max: readPositiveInteger('PG_POOL_MAX', 10),
  connectionTimeoutMillis: readPositiveInteger('PG_CONNECT_TIMEOUT_MS', 10_000),
  idleTimeoutMillis: readPositiveInteger('PG_IDLE_TIMEOUT_MS', 30_000),
  application_name: process.env.PGAPPNAME ?? 'dish-api',
});

pool.on('error', (error) => {
  // A pool can emit errors for idle clients. Keep the process alive so the
  // service can recover, but make the failure visible to Railway logs.
  console.error('[database] idle client error', error);
});

export function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<Row>> {
  return pool.query<Row>(text, params);
}

export async function withTransaction<Result>(
  callback: (client: PoolClient) => Promise<Result>,
): Promise<Result> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[database] rollback failed', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

let schemaPromise: Promise<void> | undefined;

/**
 * Applies the idempotent base schema under a PostgreSQL advisory lock.
 * Calling this from every API boot is safe; concurrent deploys serialize.
 */
export function ensureSchema(): Promise<void> {
  schemaPromise ??= applySchema().catch((error) => {
    schemaPromise = undefined;
    throw error;
  });
  return schemaPromise;
}

async function applySchema(): Promise<void> {
  if (!databaseUrl && !process.env.PGHOST) {
    throw new Error('DATABASE_URL (or standard PG* variables) must be configured');
  }

  const schemaPath = findSchemaPath();
  const sql = readFileSync(schemaPath, 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');

  await withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dish-schema-v1'))");
    await client.query(sql);
    await client.query(
      `
        INSERT INTO schema_migrations (version, checksum, applied_at)
        VALUES ($1, $2, now())
        ON CONFLICT (version) DO UPDATE
        SET checksum = EXCLUDED.checksum,
            applied_at = EXCLUDED.applied_at
      `,
      ['001_base_schema', checksum],
    );
  });
}

function findSchemaPath(): string {
  const candidates = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../src/schema.sql'),
    path.resolve(process.cwd(), 'server/src/schema.sql'),
    path.resolve(process.cwd(), 'src/schema.sql'),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(`Could not locate schema.sql. Checked: ${candidates.join(', ')}`);
  }
  return match;
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

// Compatibility aliases for callers written against the earlier plan.
export const transaction = withTransaction;
export const migrate = ensureSchema;
