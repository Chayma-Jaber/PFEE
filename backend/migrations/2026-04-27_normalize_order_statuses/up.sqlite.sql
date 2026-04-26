-- =============================================================
-- Migration: normalize_order_statuses (SQLite)
-- Date:      2026-04-27
-- Idempotent: skips already-uppercase rows.
-- =============================================================

UPDATE orders
SET status = UPPER(status)
WHERE status IS NOT NULL
  AND status <> UPPER(status);

UPDATE orders
SET payment_status = UPPER(payment_status)
WHERE payment_status IS NOT NULL
  AND payment_status <> UPPER(payment_status);
