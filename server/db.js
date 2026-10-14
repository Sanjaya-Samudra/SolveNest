import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const databaseTls = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA.replace(/\\n/g, '\n') } : {}) } : undefined
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: databaseTls, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000 }) : null

export function hasDatabase() { return Boolean(pool) }
export function query(text, values) { if (!pool) throw new Error('DATABASE_NOT_CONFIGURED'); return pool.query(text, values) }
export async function migrate() {
  if (!pool) throw new Error('DATABASE_NOT_CONFIGURED')
  const migrationsDir = path.join(__dirname, 'migrations')
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort()
  const client = await pool.connect()
  try {
    // Hold one connection for the entire migration run; concurrent deploys fail clearly.
    const lock = await client.query('SELECT pg_try_advisory_lock(73421986) AS acquired')
    if (!lock.rows[0].acquired) throw new Error('MIGRATION_ALREADY_RUNNING')
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
    for (const filename of files) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename])
      if (applied.rowCount) continue
      const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8')
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations(filename) VALUES($1)', [filename])
        await client.query('COMMIT')
      } catch (error) { await client.query('ROLLBACK'); throw error }
    }
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(73421986)') } finally { client.release() }
  }
}
export async function closeDatabase() { await pool?.end() }
