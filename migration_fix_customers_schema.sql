-- ACEGAS ENTERPRISE - CUSTOMER SCHEMA REPAIR
-- Run this in your Supabase SQL Editor to resolve "Could not find the 'first_name' column" error.

-- 1. Add missing columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Backfill existing customer names from the 'names' array (Legacy Support)
DO $$
DECLARE 
    cust RECORD;
    full_name TEXT;
    space_idx INT;
BEGIN
    FOR cust IN SELECT id, names FROM customers WHERE (first_name IS NULL OR first_name = '') AND names IS NOT NULL AND jsonb_array_length(names) > 0 LOOP
        full_name := cust.names->>0;
        IF full_name IS NOT NULL AND full_name != '' THEN
            space_idx := position(' ' in full_name);
            
            -- Simple heuristic: Split by first space
            IF space_idx > 0 THEN
                UPDATE customers 
                SET first_name = substring(full_name from 1 for space_idx - 1),
                    last_name = substring(full_name from space_idx + 1)
                WHERE id = cust.id;
            ELSE
                UPDATE customers 
                SET first_name = full_name,
                    last_name = '.'
                WHERE id = cust.id;
            END IF;
        END IF;
    END LOOP;
END $$;

-- 3. Reload Schema Cache to apply changes immediately
NOTIFY pgrst, 'reload schema';
