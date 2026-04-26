-- =============================================================
-- Migration: seller_fulfillments
-- Engine:    Microsoft SQL Server (primary)
-- Date:      2026-04-26
--
-- Purpose: per-order-item fulfillment record for marketplace sellers.
--          Indexed by order_item_id (unique), order_id, seller_id, status.
--
-- Idempotent: safe to re-run. Each statement is guarded by an existence check.
-- =============================================================

IF OBJECT_ID('dbo.seller_fulfillments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.seller_fulfillments (
        id              INT             IDENTITY(1,1) PRIMARY KEY,
        order_item_id   INT             NOT NULL,
        order_id        INT             NOT NULL,
        seller_id       INT             NOT NULL,
        status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
        tracking_number VARCHAR(80)     NULL,
        carrier         VARCHAR(60)     NULL,
        tracking_url    VARCHAR(500)    NULL,
        notes           NVARCHAR(500)   NULL,
        shipped_at      DATETIME        NULL,
        delivered_at    DATETIME        NULL,
        cancelled_at    DATETIME        NULL,
        created_at      DATETIME        NOT NULL DEFAULT (GETDATE()),
        updated_at      DATETIME        NOT NULL DEFAULT (GETDATE())
    );
    PRINT 'Created table: seller_fulfillments';
END
ELSE
    PRINT 'Skipped table: seller_fulfillments already exists';
GO

-- Unique index on order_item_id (one fulfillment per order item)
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IDX_seller_fulfillments_order_item'
                 AND object_id = OBJECT_ID('dbo.seller_fulfillments'))
BEGIN
    CREATE UNIQUE INDEX IDX_seller_fulfillments_order_item
        ON dbo.seller_fulfillments (order_item_id);
    PRINT 'Created index: IDX_seller_fulfillments_order_item (unique)';
END
ELSE
    PRINT 'Skipped index: IDX_seller_fulfillments_order_item already exists';
GO

-- Lookup indexes for the listing queries (orders for a seller, status filter)
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IDX_seller_fulfillments_order_id'
                 AND object_id = OBJECT_ID('dbo.seller_fulfillments'))
BEGIN
    CREATE INDEX IDX_seller_fulfillments_order_id
        ON dbo.seller_fulfillments (order_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IDX_seller_fulfillments_seller_id'
                 AND object_id = OBJECT_ID('dbo.seller_fulfillments'))
BEGIN
    CREATE INDEX IDX_seller_fulfillments_seller_id
        ON dbo.seller_fulfillments (seller_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IDX_seller_fulfillments_status'
                 AND object_id = OBJECT_ID('dbo.seller_fulfillments'))
BEGIN
    CREATE INDEX IDX_seller_fulfillments_status
        ON dbo.seller_fulfillments (status);
END
GO

-- Sanity check
SELECT 'seller_fulfillments rowcount' AS check_name, COUNT(*) AS rows
FROM dbo.seller_fulfillments;
