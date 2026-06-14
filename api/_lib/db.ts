import { createPool, VercelPool } from "@vercel/postgres";
import { IStorage } from "../../src/types";

// Single-user fork: one row holds the full IStorage (which already nests _versions and originalId).
export const USER_ID = "me";
export const USER_EMAIL = "me@workoutthing.local";

// Resolve the connection string regardless of which env var name the Neon/Vercel
// integration used (the "Custom Environment Variable Prefix" can rename POSTGRES_URL).
function connectionString(): string {
  const candidates = [
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
    process.env.STORAGE_POSTGRES_URL,
    process.env.STORAGE_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL_UNPOOLED,
  ];
  const found = candidates.find((c) => typeof c === "string" && c.length > 0);
  if (!found) {
    throw new Error("No Postgres connection string found (set POSTGRES_URL or DATABASE_URL)");
  }
  return found;
}

let pool: VercelPool | undefined;
function getPool(): VercelPool {
  if (!pool) {
    pool = createPool({ connectionString: connectionString() });
  }
  return pool;
}

let ensured = false;
async function ensureTable(): Promise<void> {
  if (ensured) {
    return;
  }
  await getPool().sql`CREATE TABLE IF NOT EXISTS ws_sync (
    user_id text PRIMARY KEY,
    storage_json jsonb NOT NULL,
    updated_at bigint NOT NULL
  )`;
  ensured = true;
}

export async function Db_getStorage(userId: string): Promise<IStorage | undefined> {
  await ensureTable();
  const { rows } = await getPool().sql`SELECT storage_json FROM ws_sync WHERE user_id = ${userId}`;
  if (rows.length === 0) {
    return undefined;
  }
  return rows[0].storage_json as IStorage;
}

export async function Db_saveStorage(userId: string, storage: IStorage): Promise<void> {
  await ensureTable();
  const json = JSON.stringify(storage);
  await getPool().sql`INSERT INTO ws_sync (user_id, storage_json, updated_at)
    VALUES (${userId}, ${json}::jsonb, ${Date.now()})
    ON CONFLICT (user_id) DO UPDATE SET storage_json = EXCLUDED.storage_json, updated_at = EXCLUDED.updated_at`;
}
