-- =============================================================
-- Migration: normalize_order_statuses (Postgres)
-- Date:      2026-04-27
-- Idempotent: skips rows already canonical.
-- =============================================================

UPDATE orders
SET status = UPPER(status)
WHERE status IS NOT NULL
  AND status <> UPPER(status);

UPDATE orders
SET payment_status = UPPER(payment_status)
WHERE payment_status IS NOT NULL
  AND payment_status <> UPPER(payment_status);

-- Audit
SELECT 'after_normalize' AS audit_phase, status, COUNT(*) AS row_count
FROM orders
GROUP BY status
ORDER BY row_count DESC;
