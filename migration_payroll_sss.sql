-- ACEGAS ENTERPRISE - PAYROLL INTEGRITY PATCH (V1.5.5)
-- Adds tracking for SSS loan balances to mirror Excel sheets.

ALTER TABLE IF EXISTS employees 
ADD COLUMN IF NOT EXISTS sss_loan_balance NUMERIC DEFAULT 0;

COMMENT ON COLUMN employees.sss_loan_balance IS 'Running balance of the personnel SSS loan registry';

-- Force schema reload
NOTIFY pgrst, 'reload schema';