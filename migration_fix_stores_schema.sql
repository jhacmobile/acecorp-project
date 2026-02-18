-- ACEGAS ENTERPRISE - STORES SCHEMA REPAIR
-- Run this in your Supabase SQL Editor to resolve "column not found" errors.

BEGIN;
  -- 1. Ensure columns exist in the stores table
  ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS mobile TEXT;
  ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS location TEXT;
  ALTER TABLE IF EXISTS stores ADD COLUMN IF NOT EXISTS is_warehouse BOOLEAN DEFAULT FALSE;

  -- 2. Verify chat_messages has all necessary fields
  ALTER TABLE IF EXISTS chat_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
  ALTER TABLE IF EXISTS chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

  -- 3. Reset the Realtime Publication to include the repaired tables
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE chat_messages, stores, orders, stocks;
COMMIT;

-- Force a PostgREST cache reload by notifying the channel (Supabase internal)
NOTIFY pgrst, 'reload schema';