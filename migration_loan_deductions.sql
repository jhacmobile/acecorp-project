-- ACEGAS ENTERPRISE - PAYROLL AUTOMATION PATCH (V1.5.9)
-- Adds storage for weekly deduction amounts to automate payroll calculations.

ALTER TABLE IF EXISTS employees 
ADD COLUMN IF NOT EXISTS loan_weekly_deduction NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sss_loan_weekly_deduction NUMERIC DEFAULT 0;

COMMENT ON COLUMN employees.loan_weekly_deduction IS 'Automated weekly deduction amount for long-term loans';
COMMENT ON COLUMN employees.sss_loan_weekly_deduction IS 'Automated weekly deduction amount for SSS loans';

-- Force schema reload
NOTIFY pgrst, 'reload schema';