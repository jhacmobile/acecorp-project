
-- ACEGAS ENTERPRISE - LOAN PERSISTENCE PATCH (V1.7.5)
-- Ensures all deduction plan fields are stored in the cloud.

ALTER TABLE IF EXISTS employees 
ADD COLUMN IF NOT EXISTS loan_frequency TEXT DEFAULT 'WEEKLY',
ADD COLUMN IF NOT EXISTS loan_term_months NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sss_loan_frequency TEXT DEFAULT 'WEEKLY',
ADD COLUMN IF NOT EXISTS sss_loan_term_months NUMERIC DEFAULT 0;

COMMENT ON COLUMN employees.loan_frequency IS 'Frequency of salary loan deduction: WEEKLY, BI_MONTHLY, MONTHLY';
COMMENT ON COLUMN employees.sss_loan_frequency IS 'Frequency of SSS loan deduction: WEEKLY, BI_MONTHLY, MONTHLY';

-- Force schema reload
NOTIFY pgrst, 'reload schema';
