-- ACEGAS ENTERPRISE - PAYMENT PROTOCOL PATCH (V1.7.1)
-- Adds storage for granular payment method tracking including 'OTHER'.

ALTER TABLE IF EXISTS orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH';

COMMENT ON COLUMN orders.payment_method IS 'Settlement method: CASH, EWALLET - MAYA, E-WALLET GCASH, BANK, OTHER';

-- Initialize existing records to CASH if they are NULL
UPDATE orders SET payment_method = 'CASH' WHERE payment_method IS NULL;

-- Ensure receivable_payments also supports the updated list
ALTER TABLE IF EXISTS receivable_payments 
ALTER COLUMN payment_method SET DEFAULT 'CASH';

-- Force schema reload
NOTIFY pgrst, 'reload schema';