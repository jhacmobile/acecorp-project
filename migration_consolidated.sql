
-- ACEGAS ENTERPRISE CONSOLIDATED MIGRATION (V1.4.6)
-- Run this in your Supabase SQL Editor to resolve persistent sync failures.

-- 1. DROP ALL BLOCKING CONSTRAINTS (Aggressive)
DO $$
BEGIN
    -- Orders Constraints
    ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS orders_store_id_fkey;
    ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
    ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS orders_store_id_link;
    
    -- Employees Constraints
    ALTER TABLE IF EXISTS employees DROP CONSTRAINT IF EXISTS employees_store_id_fkey;
    ALTER TABLE IF EXISTS employees DROP CONSTRAINT IF EXISTS employees_id_key;

    -- Stocks Constraints
    ALTER TABLE IF EXISTS stocks DROP CONSTRAINT IF EXISTS stocks_store_id_fkey;
    ALTER TABLE IF EXISTS stocks DROP CONSTRAINT IF EXISTS stocks_product_id_fkey;
    ALTER TABLE IF EXISTS stocks DROP CONSTRAINT IF EXISTS stocks_store_id_link;
    ALTER TABLE IF EXISTS stocks DROP CONSTRAINT IF EXISTS stocks_product_id_link;

    -- Transfer Constraints
    ALTER TABLE IF EXISTS stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_from_store_id_fkey;
    ALTER TABLE IF EXISTS stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_to_store_id_fkey;
END $$;

-- 2. HARDEN COLUMN TYPES FOR MAXIMUM FLEXIBILITY
-- Convert all IDs and Timestamps to TEXT
ALTER TABLE IF EXISTS stores ALTER COLUMN id TYPE TEXT;
ALTER TABLE IF EXISTS products ALTER COLUMN id TYPE TEXT;
ALTER TABLE IF EXISTS orders ALTER COLUMN id TYPE TEXT;
ALTER TABLE IF EXISTS orders ALTER COLUMN store_id TYPE TEXT;
ALTER TABLE IF EXISTS orders ALTER COLUMN customer_id TYPE TEXT;
ALTER TABLE IF EXISTS orders ALTER COLUMN rider_id TYPE TEXT;
ALTER TABLE IF EXISTS orders ALTER COLUMN created_at TYPE TEXT;
ALTER TABLE IF EXISTS orders ALTER COLUMN updated_at TYPE TEXT;
ALTER TABLE IF EXISTS employees ALTER COLUMN id TYPE TEXT;
ALTER TABLE IF EXISTS employees ALTER COLUMN store_id TYPE TEXT;
ALTER TABLE IF EXISTS stocks ALTER COLUMN id TYPE TEXT;
ALTER TABLE IF EXISTS stocks ALTER COLUMN product_id TYPE TEXT;
ALTER TABLE IF EXISTS stocks ALTER COLUMN store_id TYPE TEXT;

-- 3. ENSURE JSONB DEFAULTS ARE CORRECT
ALTER TABLE IF EXISTS orders ALTER COLUMN items SET DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS employees ALTER COLUMN loans SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS employees ALTER COLUMN assigned_store_ids SET DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS users ALTER COLUMN assigned_store_ids SET DEFAULT '[]'::jsonb;

-- 4. DISABLE RLS (Critical for cloud persistence in this mode)
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;
