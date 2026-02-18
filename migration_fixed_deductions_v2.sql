
-- ACEGAS ENTERPRISE - FIXED DEDUCTION PERSISTENCE FIX
-- Run this in your Supabase SQL Editor

ALTER TABLE IF EXISTS employees 
ADD COLUMN IF NOT EXISTS loan_weekly_deduction NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sss_loan_weekly_deduction NUMERIC DEFAULT 0;

COMMENT ON COLUMN employees.loan_weekly_deduction IS 'Fixed deduction amount for salary loans per payroll cycle';
COMMENT ON COLUMN employees.sss_loan_weekly_deduction IS 'Fixed deduction amount for SSS loans per payroll cycle';

-- Ensure schema cache is updated
NOTIFY pgrst, 'reload schema';
