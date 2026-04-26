-- =============================================================
-- Migration: normalize_order_statuses
-- Engine:    Microsoft SQL Server
-- Date:      2026-04-27
--
-- Purpose: legacy data from the wave-1 import has lowercase order status values
--          ('shipped', 'delivered', 'cancelled', etc.). The canonical OrderStatus
--          enum uses uppercase. This migration uppercases all `orders.status` rows
--          so we can drop case-insensitive comparisons in app code.
--
-- Idempotent: re-running is a no-op (the CASE only updates rows where status
--             differs from its uppercase form).
--
-- Non-destructive: only mutates string casing — never changes meaning.
-- =============================================================

DECLARE @affected INT = 0;

-- Snapshot the inventory BEFORE so the audit log shows what we're about to fix
SELECT
    'before_normalize' AS audit_phase,
    status AS status_value,
    COUNT(*) AS row_count
FROM dbo.orders
GROUP BY status
ORDER BY row_count DESC;

UPDATE dbo.orders
SET status = UPPER(status)
WHERE status IS NOT NULL
  AND status <> UPPER(status);

SET @affected = @@ROWCOUNT;
PRINT CONCAT('Normalized ', @affected, ' order status row(s)');
GO

-- Same treatment for payment_status — same legacy issue, same fix.
UPDATE dbo.orders
SET payment_status = UPPER(payment_status)
WHERE payment_status IS NOT NULL
  AND payment_status <> UPPER(payment_status);

PRINT CONCAT('Normalized ', @@ROWCOUNT, ' payment_status row(s)');
GO

-- Final audit
SELECT
    'after_normalize' AS audit_phase,
    status AS status_value,
    COUNT(*) AS row_count
FROM dbo.orders
GROUP BY status
ORDER BY row_count DESC;
