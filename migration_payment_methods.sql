-- ACEGAS ENTERPRISE - PAYMENT PROTOCOL PATCH (V1.7.0)
-- Adds storage for granular payment method tracking.

ALTER TABLE IF EXISTS orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH';

COMMENT ON COLUMN orders.payment_method IS 'Settlement method: CASH, EWALLET - MAYA, E-WALLET GCASH, BANK';

-- Initialize existing records to CASH
UPDATE orders SET payment_method = 'CASH' WHERE payment_method IS NULL;

-- Force schema reload
NOTIFY pgrst, 'reload schema';