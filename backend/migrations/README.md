# Production migrations

Each subfolder is one migration named `YYYY-MM-DD_description/`. Files are idempotent (`IF NOT EXISTS` / `OBJECT_ID IS NULL` / case-insensitive update guards) so re-running is safe.

**In dev** (`NODE_ENV=development`), `TypeORM.synchronize=true` creates schema automatically. These scripts are NOT needed for new schema in dev. They MAY be needed for *data* migrations (e.g., normalizing legacy values) even in dev — run the same command.

## Recommended path: the runner

Use the bundled runner. It picks the right `.sql` variant per engine, tracks applied migrations in a `_migration_history` table, and skips ones already applied.

```bash
cd backend

# See what would run (no DB writes)
npm run migrate:dry

# Apply all pending migrations
npm run migrate

# Roll one back (DESTRUCTIVE — runs the migration's down.sql)
npm run migrate:rollback 2026-04-26_seller_fulfillments
```

The runner reads `database.type` from your `.env` and picks:
- `mssql`    → `up.sql`         (handles `GO` batch separators automatically)
- `postgres` → `up.postgres.sql` (falls back to `up.sql` if absent)
- `sqlite`   → `up.sqlite.sql`

It records each successful apply with id, timestamp, duration, and a djb2 checksum of the script content (for drift detection). Failures abort the run; subsequent migrations aren't attempted.

## Manual fallback (no Node available)

Apply scripts in date order with the right engine client.

### MSSQL

```bash
sqlcmd -S DESKTOP-KOR5QAB -d barsha -U admin -P admin123 \
  -i 2026-04-26_seller_fulfillments/up.sql

sqlcmd -S DESKTOP-KOR5QAB -d barsha -U admin -P admin123 \
  -i 2026-04-27_normalize_order_statuses/up.sql
```

### Postgres

```bash
psql "$DATABASE_URL" -f 2026-04-26_seller_fulfillments/up.postgres.sql
psql "$DATABASE_URL" -f 2026-04-27_normalize_order_statuses/up.postgres.sql
```

### SQLite

```bash
sqlite3 barsha.db < 2026-04-26_seller_fulfillments/up.sqlite.sql
sqlite3 barsha.db < 2026-04-27_normalize_order_statuses/up.sqlite.sql
```

When using the manual fallback you also need to record the apply in `_migration_history` yourself, otherwise the runner will try to re-apply on next invocation. The scripts are idempotent so a re-apply is safe but noisy.

## Rollback

Each migration ships a `down.sql` (or `.postgres.sql`/`.sqlite.sql` variant) when rollback is meaningful. Pure data migrations (like `normalize_order_statuses`) are typically irreversible — there's no way to know which of the original rows were lowercase vs uppercase.

## Migration list

| Date | Folder | Description | Reversible |
|---|---|---|---|
| 2026-04-26 | `2026-04-26_seller_fulfillments` | Per-order-item fulfillment tracking for marketplace sellers | yes |
| 2026-04-27 | `2026-04-27_normalize_order_statuses` | UPPERCASE all `orders.status` and `orders.payment_status` values | no (data normalization) |

## Authoring a new migration

1. Create a folder named `YYYY-MM-DD_short_name/`.
2. Drop in `up.sql` (MSSQL — guard with `IF NOT EXISTS` / `OBJECT_ID IS NULL`).
3. Optionally `up.postgres.sql` and `up.sqlite.sql` for the other engines if syntax differs.
4. Optionally `down.sql` (and engine variants) if reversal is meaningful.
5. Run `npm run migrate:dry` to verify the runner picks it up.
6. Run `npm run migrate` to apply.

The runner sorts folders alphabetically — that's why the date prefix is the first component. Don't rename a folder once it's been applied in any environment; the `_migration_history.id` is the folder name.
