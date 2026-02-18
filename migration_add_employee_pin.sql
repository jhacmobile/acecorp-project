
-- ACEGAS ENTERPRISE - PIN SECURITY PATCH
-- Ensures the security PIN column is available for Bandi Terminal identity verification.

ALTER TABLE IF EXISTS employees 
ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '';

COMMENT ON COLUMN employees.pin IS '4-digit security code for Bandi Terminal attendance verification';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
