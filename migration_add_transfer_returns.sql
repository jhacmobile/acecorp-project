-- Migration: Add returned_items to stock_transfers
-- Support for Philgas "Refill-for-Empty" transfer logic

ALTER TABLE stock_transfers 
ADD COLUMN IF NOT EXISTS returned_items JSONB DEFAULT '[]';

-- Create table if it doesn't exist (if setup was incomplete)
CREATE TABLE IF NOT EXISTS stock_transfers (
    id TEXT PRIMARY KEY,
    from_store_id TEXT REFERENCES stores(id),
    to_store_id TEXT REFERENCES stores(id),
    items JSONB DEFAULT '[]',
    returned_items JSONB DEFAULT '[]',
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);