/**
 * Production migration runner.
 *
 * Reads `backend/migrations/{date}_{name}/up.{ext}.sql` files in alphabetical
 * (=date) order, applies each one not yet listed in `_migration_history`, and
 * records it. Idempotent: re-runs are no-ops.
 *
 * Picks the right `.sql` variant based on the `database.type` config:
 *   - mssql   → up.sql
 *   - postgres → up.postgres.sql
 *   - sqlite  → up.sqlite.sql
 *
 * Run with:
 *   cd backend && npx ts-node scripts/run-migrations.ts
 *
 * Optional flags:
 *   --dry-run      Show what would run, don't execute.
 *   --rollback ID  Run the matching folder's `down.sql` (DESTRUCTIVE).
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rollbackIdx = args.indexOf('--rollback');
const rollbackId = rollbackIdx >= 0 ? args[rollbackIdx + 1] : null;

// ─── Standalone config (no NestJS imports) ─────────────────────────────────
// Mirrors the resolution rules in src/database/database.module.ts so the runner
// reads exactly the same env vars as the live app, without dragging in the rest
// of the NestJS module graph (so this script compiles to plain JS for prod hosts
// that don't ship ts-node).
const dbType = ((process.env.DB_TYPE as any) || 'mssql') as 'mssql' | 'postgres' | 'sqlite';
// Resolve `backend/migrations/` regardless of whether we're running from
// scripts/ (ts-node) or dist/scripts/ (compiled prod). The convention is
// that all npm scripts run with cwd=backend, so cwd-relative is unambiguous.
const MIGRATIONS_DIR = (() => {
  const fromCwd = path.resolve(process.cwd(), 'migrations');
  if (fs.existsSync(fromCwd)) return fromCwd;
  // Fallback for unusual cwds: walk up from __dirname looking for migrations/
  const fromDirname = path.resolve(__dirname, '..', 'migrations');
  if (fs.existsSync(fromDirname)) return fromDirname;
  // Last-resort: dist/scripts/../../migrations
  return path.resolve(__dirname, '..', '..', 'migrations');
})();

function getDataSource(): DataSource {
  if (dbType === 'mssql') {
    return new DataSource({
      type: 'mssql',
      host: process.env.DB_HOST || 'DESKTOP-KOR5QAB',
      port: parseInt(process.env.DB_PORT || '1433', 10),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'admin123',
      database: process.env.DB_NAME || 'barsha',
      options: { encrypt: false, trustServerCertificate: true },
      extra: { trustServerCertificate: true },
      synchronize: false,
      logging: false,
    });
  }
  if (dbType === 'postgres') {
    return new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL || '',
      synchronize: false,
      logging: false,
    });
  }
  // sqlite default — same resolution as database.module.ts
  const sqliteUrl = process.env.DATABASE_URL || '';
  const dbName = process.env.DB_NAME || 'barsha';
  const sqlitePath = sqliteUrl.startsWith('sqlite:///')
    ? sqliteUrl.replace(/^sqlite:\/\/\//, '')
    : (dbName !== 'barsha' ? dbName : 'barsha.db');
  return new DataSource({
    type: 'sqlite',
    database: sqlitePath,
    synchronize: false,
    logging: false,
  });
}

// ─── Migration discovery ───────────────────────────────────────────────────
function listMigrations(): Array<{ id: string; folder: string; upFile: string; downFile: string | null }> {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  const folders = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}_/.test(f) && fs.statSync(path.join(MIGRATIONS_DIR, f)).isDirectory())
    .sort();

  const ext =
    dbType === 'postgres' ? 'postgres.sql' :
    dbType === 'sqlite' ? 'sqlite.sql' :
    'sql';

  return folders.map((folder) => {
    const upFile = path.join(MIGRATIONS_DIR, folder, `up.${ext}`);
    if (!fs.existsSync(upFile)) {
      // Fall back to plain up.sql when an engine-specific variant is missing.
      const generic = path.join(MIGRATIONS_DIR, folder, 'up.sql');
      if (!fs.existsSync(generic)) return null as any;
      return { id: folder, folder, upFile: generic, downFile: null };
    }
    // Look for engine-specific down.sql variants too
    const candidates = [
      path.join(MIGRATIONS_DIR, folder, `down.${ext}`),
      path.join(MIGRATIONS_DIR, folder, 'down.sql'),
    ];
    const downFile = candidates.find((p) => fs.existsSync(p)) || null;
    return { id: folder, folder, upFile, downFile };
  }).filter(Boolean);
}

// ─── History table ─────────────────────────────────────────────────────────
async function ensureHistoryTable(ds: DataSource) {
  if (dbType === 'mssql') {
    await ds.query(`
      IF OBJECT_ID('dbo._migration_history', 'U') IS NULL
        CREATE TABLE dbo._migration_history (
          id          VARCHAR(120) NOT NULL PRIMARY KEY,
          applied_at  DATETIME     NOT NULL DEFAULT (GETDATE()),
          duration_ms INT          NULL,
          checksum    VARCHAR(64)  NULL
        )
    `);
  } else if (dbType === 'postgres') {
    await ds.query(`
      CREATE TABLE IF NOT EXISTS _migration_history (
        id          VARCHAR(120) NOT NULL PRIMARY KEY,
        applied_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
        duration_ms INTEGER,
        checksum    VARCHAR(64)
      )
    `);
  } else {
    await ds.query(`
      CREATE TABLE IF NOT EXISTS _migration_history (
        id          TEXT NOT NULL PRIMARY KEY,
        applied_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        duration_ms INTEGER,
        checksum    TEXT
      )
    `);
  }
}

// Each driver expects a different placeholder syntax: pg uses $1, mssql uses @0,
// sqlite uses ?. Centralize so we don't get this wrong per-query (we did get it
// wrong: alreadyApplied/previousChecksum used `?` for mssql which fails with
// "Incorrect syntax near '?'.").
function paramPlaceholder(): string {
  if (dbType === 'postgres') return '$1';
  if (dbType === 'mssql') return '@0';
  return '?';
}
function historyTable(): string {
  return dbType === 'mssql' ? 'dbo._migration_history' : '_migration_history';
}

async function alreadyApplied(ds: DataSource, id: string): Promise<boolean> {
  const rows = await ds.query(
    `SELECT 1 AS one FROM ${historyTable()} WHERE id = ${paramPlaceholder()}`,
    [id],
  );
  return rows && rows.length > 0;
}

// Returns the previously stored checksum for a migration, or null if not applied.
async function previousChecksum(ds: DataSource, id: string): Promise<string | null> {
  const rows = await ds.query(
    `SELECT checksum FROM ${historyTable()} WHERE id = ${paramPlaceholder()}`,
    [id],
  );
  if (!rows || rows.length === 0) return null;
  return rows[0].checksum || rows[0].CHECKSUM || null;
}

async function recordApplied(ds: DataSource, id: string, durationMs: number, checksum: string) {
  if (dbType === 'mssql') {
    await ds.query(
      `INSERT INTO dbo._migration_history (id, duration_ms, checksum) VALUES (@0, @1, @2)`,
      [id, durationMs, checksum],
    );
  } else if (dbType === 'postgres') {
    await ds.query(
      `INSERT INTO _migration_history (id, duration_ms, checksum) VALUES ($1, $2, $3)`,
      [id, durationMs, checksum],
    );
  } else {
    await ds.query(
      `INSERT INTO _migration_history (id, duration_ms, checksum) VALUES (?, ?, ?)`,
      [id, durationMs, checksum],
    );
  }
}

async function removeApplied(ds: DataSource, id: string) {
  if (dbType === 'mssql') {
    await ds.query(`DELETE FROM dbo._migration_history WHERE id = @0`, [id]);
  } else if (dbType === 'postgres') {
    await ds.query(`DELETE FROM _migration_history WHERE id = $1`, [id]);
  } else {
    await ds.query(`DELETE FROM _migration_history WHERE id = ?`, [id]);
  }
}

// ─── SQL execution ─────────────────────────────────────────────────────────
// MSSQL scripts use `GO` as a batch separator that the driver doesn't understand
// natively — split on lines that are exactly `GO` (case-insensitive, trimmed).
function splitMssqlBatches(sql: string): string[] {
  return sql
    .split(/^\s*GO\s*$/im)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function executeSql(ds: DataSource, sql: string) {
  if (dbType === 'mssql') {
    for (const batch of splitMssqlBatches(sql)) {
      await ds.query(batch);
    }
  } else {
    await ds.query(sql);
  }
}

function checksum(content: string): string {
  // Tiny djb2 hash — we don't need cryptographic strength, just drift detection.
  let h = 5381;
  for (let i = 0; i < content.length; i++) h = ((h << 5) + h + content.charCodeAt(i)) | 0;
  return `djb2:${(h >>> 0).toString(16)}`;
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const ds = getDataSource();
  await ds.initialize();
  console.log(`[migrate] Connected to ${dbType}`);

  await ensureHistoryTable(ds);

  if (rollbackId) {
    const all = listMigrations();
    const target = all.find((m) => m.id === rollbackId);
    if (!target) { console.error(`[migrate] Migration not found: ${rollbackId}`); process.exit(1); }
    if (!target.downFile) { console.error(`[migrate] No down.sql for ${rollbackId}`); process.exit(1); }
    if (!await alreadyApplied(ds, target.id)) {
      console.log(`[migrate] Migration ${target.id} is not applied — nothing to roll back.`); await ds.destroy(); return;
    }
    console.log(`[migrate] ⚠ ROLLBACK ${target.id} — running ${path.basename(target.downFile)}`);
    if (dryRun) { console.log('[migrate] (dry-run) skipping execution'); await ds.destroy(); return; }
    const sql = fs.readFileSync(target.downFile, 'utf8');
    await executeSql(ds, sql);
    await removeApplied(ds, target.id);
    console.log(`[migrate] Rolled back ${target.id}`);
    await ds.destroy();
    return;
  }

  const all = listMigrations();
  if (all.length === 0) { console.log('[migrate] No migrations found.'); await ds.destroy(); return; }

  let ranCount = 0;
  let driftCount = 0;
  for (const m of all) {
    const sql = fs.readFileSync(m.upFile, 'utf8');
    const cks = checksum(sql);
    if (await alreadyApplied(ds, m.id)) {
      // Drift detection: if the file content changed since first apply, the
      // operator very likely edited a migration that's already in production.
      // We do NOT silently re-apply (could corrupt state) — we warn and skip.
      const prev = await previousChecksum(ds, m.id);
      if (prev && prev !== cks) {
        console.warn(`[migrate] ⚠ ${m.id} (already applied, but checksum drifted: ${prev} → ${cks})`);
        console.warn(`[migrate]   The migration file was edited after being applied. If the change is`);
        console.warn(`[migrate]   meaningful, ship it as a NEW migration. If it's just whitespace, run`);
        console.warn(`[migrate]   manually: UPDATE _migration_history SET checksum='${cks}' WHERE id='${m.id}'`);
        driftCount++;
      } else {
        console.log(`[migrate] ✓ ${m.id} (already applied)`);
      }
      continue;
    }
    console.log(`[migrate] → ${m.id}  (${path.basename(m.upFile)}, ${sql.length} chars, ${cks})`);
    if (dryRun) { console.log('[migrate]   (dry-run) skipping execution'); continue; }
    const t0 = Date.now();
    try {
      await executeSql(ds, sql);
      const dt = Date.now() - t0;
      await recordApplied(ds, m.id, dt, cks);
      console.log(`[migrate]   ✓ applied in ${dt}ms`);
      ranCount++;
    } catch (err: any) {
      console.error(`[migrate]   ✗ FAILED: ${err?.message || err}`);
      console.error(`[migrate]   migration ${m.id} aborted; subsequent migrations not run.`);
      await ds.destroy();
      process.exit(1);
    }
  }
  console.log(`[migrate] Done. ${ranCount} applied, ${driftCount} drift warning(s) this run.`);
  await ds.destroy();
  if (driftCount > 0) process.exit(2); // distinct from "everything fine" so CI can flag it
}

main().catch((err) => {
  console.error('[migrate] FATAL:', err?.message || err);
  process.exit(1);
});
