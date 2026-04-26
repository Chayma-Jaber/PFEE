-- =============================================================
-- Rollback: seller_fulfillments
-- Engine:   Microsoft SQL Server
-- Drops the table and all indexes (cascades).
-- DESTRUCTIVE — every fulfillment row is lost. Back up first.
-- =============================================================

IF OBJECT_ID('dbo.seller_fulfillments', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.seller_fulfillments;
    PRINT 'Dropped table: seller_fulfillments';
END
ELSE
    PRINT 'Skipped: seller_fulfillments does not exist';
GO
