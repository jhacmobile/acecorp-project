
-- ACECORP ENTERPRISE MANAGEMENT SYSTEM (V1.5.0)
-- RE-PROVISIONING DATABASE CORE

-- 1. Operational Nodes
CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    phone TEXT,
    mobile TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Personnel Registry
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    assigned_store_ids JSONB DEFAULT '[]',
    employee_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- STAFF, RIDER
    salary NUMERIC(12,2) NOT NULL,
    shift_start TEXT DEFAULT '08:00',
    shift_end TEXT DEFAULT '17:00',
    loan_balance NUMERIC(12,2) DEFAULT 0,
    loan_weekly_deduction NUMERIC(12,2) DEFAULT 0,
    sss_loan_balance NUMERIC(12,2) DEFAULT 0,
    sss_loan_weekly_deduction NUMERIC(12,2) DEFAULT 0,
    vale_balance NUMERIC(12,2) DEFAULT 0,
    loan_terms TEXT DEFAULT '0',
    loans JSONB DEFAULT '{}',
    loan_balances JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Attendance Registry
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
    status TEXT DEFAULT 'REGULAR', -- REGULAR, OB, PTO, ABSENT
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Payroll History
CREATE TABLE IF NOT EXISTS payroll_history (
    id TEXT PRIMARY KEY,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by TEXT NOT NULL,
    total_disbursement NUMERIC(12,2) DEFAULT 0,
    payroll_data JSONB DEFAULT '[]' -- Stores final computed values including incentives and ot pay
);

-- 5. Payroll Drafts
CREATE TABLE IF NOT EXISTS payroll_drafts (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    adjustments JSONB DEFAULT '{}', -- Stores manual overrides for overtime, incentives, and loan payments
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_pd_period ON payroll_drafts(period_start, period_end, store_id);

-- Disable RLS for standard system sync
ALTER TABLE IF EXISTS payroll_drafts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_history DISABLE ROW LEVEL SECURITY;
