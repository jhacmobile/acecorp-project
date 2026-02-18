-- Migration: Add status column to stocks table
-- Run this in your Supabase SQL Editor before deploying the new build.

ALTER TABLE stocks 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

-- Optional: Update existing records to have 'Active' status if they are null
UPDATE stocks SET status = 'Active' WHERE status IS NULL;