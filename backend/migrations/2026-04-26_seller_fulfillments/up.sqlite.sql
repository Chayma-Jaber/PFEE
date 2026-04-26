-- =============================================================
-- Migration: seller_fulfillments
-- Engine:    SQLite (test/local fallback)
-- Date:      2026-04-26
-- Idempotent: safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS seller_fulfillments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_item_id   INTEGER     NOT NULL,
    order_id        INTEGER     NOT NULL,
    seller_id       INTEGER     NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'PENDING',
    tracking_number TEXT,
    carrier         TEXT,
    tracking_url    TEXT,
    notes           TEXT,
    shipped_at      DATETIME,
    delivered_at    DATETIME,
    cancelled_at    DATETIME,
    created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_fulfillments_order_item
    ON seller_fulfillments (order_item_id);
CREATE INDEX IF NOT EXISTS idx_seller_fulfillments_order_id
    ON seller_fulfillments (order_id);
CREATE INDEX IF NOT EXISTS idx_seller_fulfillments_seller_id
    ON seller_fulfillments (seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_fulfillments_status
    ON seller_fulfillments (status);
