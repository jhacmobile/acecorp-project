-- ACEGAS ENTERPRISE - STOCK TRANSFER ACCOUNTABILITY PATCH
-- Adds tracking for personnel involved in asset movements.

ALTER TABLE stock_transfers 
ADD COLUMN IF NOT EXISTS initiated_by TEXT,
ADD COLUMN IF NOT EXISTS accepted_by TEXT;

COMMENT ON COLUMN stock_transfers.initiated_by IS 'Username of the operator who created the dispatch manifest';
COMMENT ON COLUMN stock_transfers.accepted_by IS 'Username of the operator who confirmed receipt of assets';