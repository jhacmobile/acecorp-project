
-- ACEGAS ENTERPRISE - FINAL LOAN PERSISTENCE & ADDITION FIX
-- Run this in your Supabase SQL Editor

ALTER TABLE IF EXISTS employees 
ADD COLUMN IF NOT EXISTS loan_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS vale_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sss_loan_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS loan_weekly_deduction NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sss_loan_weekly_deduction NUMERIC DEFAULT 0;

-- Ensure RLS is disabled as per system protocol
ALTER TABLE IF EXISTS employees DISABLE ROW LEVEL SECURITY;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
