-- ACEGAS ENTERPRISE - CHAT SYSTEM STABILITY PATCH
-- Run this in your Supabase SQL Editor if you see 'is_read column not found' errors.

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- Ensure existing messages are initialized
UPDATE chat_messages SET is_read = FALSE WHERE is_read IS NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_chat_recipient_read ON chat_messages(recipient_id, is_read);