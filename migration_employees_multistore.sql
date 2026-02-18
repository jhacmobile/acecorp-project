
-- Migration: Support Multi-Store Assignment for Employees
-- Run this in your Supabase SQL Editor

-- 1. Add the new column if it doesn't exist
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS assigned_store_ids JSONB DEFAULT '[]';

-- 2. Migrate existing data from store_id to assigned_store_ids
UPDATE employees 
SET assigned_store_ids = jsonb_build_array(store_id)
WHERE assigned_store_ids IS NULL OR assigned_store_ids = '[]'::jsonb AND store_id IS NOT NULL;

-- 3. Verify the column is accessible
COMMENT ON COLUMN employees.assigned_store_ids IS 'List of authorized store IDs for this personnel';
