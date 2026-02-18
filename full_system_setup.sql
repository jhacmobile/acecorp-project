
-- ACECORP ENTERPRISE - MASTER SYSTEM INITIALIZATION (V2.0.0)
-- RUN THIS IN THE NEW SUPABASE PROJECT SQL EDITOR

BEGIN;

-- 1. CORE TABLES
CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    phone TEXT,
    mobile TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    type TEXT,
    price NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'Active',
    size TEXT DEFAULT 'N/A',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stocks (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    quantity NUMERIC DEFAULT 0,
    initial_stock NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Active',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    names JSONB DEFAULT '[]', -- Legacy support
    addresses JSONB DEFAULT '[]',
    city TEXT,
    landmark TEXT,
    contact_number TEXT,
    discount_per_cylinder NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'CASHIER',
    assigned_store_ids JSONB DEFAULT '[]',
    selected_store_id TEXT,
    access_rights JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    employee_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- STAFF, RIDER
    salary NUMERIC(12,2) NOT NULL,
    shift_start TEXT DEFAULT '08:00',
    shift_end TEXT DEFAULT '17:00',
    pin TEXT,
    assigned_store_ids JSONB DEFAULT '[]',
    loan_balance NUMERIC(12,2) DEFAULT 0,
    loan_weekly_deduction NUMERIC(12,2) DEFAULT 0,
    vale_balance NUMERIC(12,2) DEFAULT 0,
    sss_loan_balance NUMERIC(12,2) DEFAULT 0,
    sss_loan_weekly_deduction NUMERIC(12,2) DEFAULT 0,
    loan_terms TEXT DEFAULT '0',
    loans JSONB DEFAULT '{}',
    loan_balances JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time_in TEXT,
    time_out TEXT,
    late_minutes NUMERIC DEFAULT 0,
    undertime_minutes NUMERIC DEFAULT 0,
    overtime_minutes NUMERIC DEFAULT 0,
    is_half_day BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'REGULAR',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT,
    address TEXT,
    city TEXT,
    contact TEXT,
    landmark TEXT,
    items JSONB DEFAULT '[]',
    total_amount NUMERIC(12,2) DEFAULT 0,
    total_discount NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'ORDERED',
    payment_method TEXT DEFAULT 'CASH',
    remark TEXT,
    returned_cylinder BOOLEAN DEFAULT FALSE,
    rider_id TEXT,
    rider_name TEXT,
    created_by TEXT,
    modified_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts_receivable (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    original_amount NUMERIC(12,2) NOT NULL,
    outstanding_amount NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'open',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receivable_payments (
    id TEXT PRIMARY KEY,
    receivable_id TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT DEFAULT 'CASH',
    paid_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_history (
    id TEXT PRIMARY KEY,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by TEXT NOT NULL,
    total_disbursement NUMERIC(12,2) DEFAULT 0,
    payroll_data JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS payroll_drafts (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    adjustments JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_transfers (
    id TEXT PRIMARY KEY,
    from_store_id TEXT NOT NULL,
    to_store_id TEXT NOT NULL,
    items JSONB DEFAULT '[]',
    returned_items JSONB DEFAULT '[]',
    status TEXT DEFAULT 'PENDING',
    initiated_by TEXT,
    accepted_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    sender_name TEXT,
    recipient_id TEXT NOT NULL, -- 'global' or user_id
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY,
    logo_url TEXT
);

-- 3. SECURITY & PERFORMANCE
-- Disable RLS for System Synchronization Protocol
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I DISABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Enable Realtime for critical tables
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE chat_messages, orders, stocks, stock_transfers;

-- Indices
CREATE INDEX IF NOT EXISTS idx_stocks_lookup ON stocks(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_date ON orders(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient ON chat_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);

-- 4. STORAGE SETUP
-- Create the bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'assets');
CREATE POLICY "System Upload Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets');
CREATE POLICY "System Update Access" ON storage.objects FOR UPDATE USING (bucket_id = 'assets');

COMMIT;
