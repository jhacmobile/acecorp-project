-- ACEGAS ENTERPRISE - REAL-TIME COMMS PROTOCOL
-- Run this in your Supabase SQL Editor to enable low-latency updates.

-- 1. Enable Realtime for Chat
BEGIN;
  -- Remove existing if present to avoid errors
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS chat_messages;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS stores;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS orders;
  
  -- Add tables to the publication
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE stores;
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
COMMIT;

-- 2. Ensure IDs are indexed for fast lookup during sync
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_recipient ON chat_messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_stores_code ON stores(code);