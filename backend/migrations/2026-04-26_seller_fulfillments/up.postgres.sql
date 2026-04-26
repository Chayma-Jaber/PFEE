-- =============================================================
-- Migration: seller_fulfillments
-- Engine:    PostgreSQL (alternate)
-- Date:      2026-04-26
-- Idempotent: safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS seller_fulfillments (
    id              SERIAL PRIMARY KEY,
    order_item_id   INTEGER     NOT NULL,
    order_id        INTEGER     NOT NULL,
    seller_id       INTEGER     NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    tracking_number VARCHAR(80),
    carrier         VARCHAR(60),
    tracking_url    VARCHAR(500),
    notes           VARCHAR(500),
    shipped_at      TIMESTAMP,
    delivered_at    TIMESTAMP,
    cancelled_at    TIMESTAMP,
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_fulfillments_order_item
    ON seller_fulfillments (order_item_id);

CREATE INDEX IF NOT EXISTS idx_seller_fulfillments_order_id
    ON seller_fulfillments (order_id);

CREATE INDEX IF NOT EXISTS idx_seller_fulfillments_seller_id
    ON seller_fulfillments (seller_id);

CREATE INDEX IF NOT EXISTS idx_seller_fulfillments_status
    ON seller_fulfillments (status);

-- updated_at trigger (Postgres has no auto-update like MSSQL)
CREATE OR REPLACE FUNCTION trg_seller_fulfillments_touch()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS seller_fulfillments_touch ON seller_fulfillments;
CREATE TRIGGER seller_fulfillments_touch
    BEFORE UPDATE ON seller_fulfillments
    FOR EACH ROW
    EXECUTE FUNCTION trg_seller_fulfillments_touch();
