-- ACEGAS ENTERPRISE - PAYROLL ARCHIVE REGISTRY (V1.5.8)
-- Supports persistent historical snapshots for audit and reprinting.

CREATE TABLE IF NOT EXISTS payroll_history (
    id TEXT PRIMARY KEY,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by TEXT NOT NULL,
    total_disbursement NUMERIC(12,2) DEFAULT 0,
    payroll_data JSONB DEFAULT '[]'
);

COMMENT ON TABLE payroll_history IS 'Snapshot archive of workforce settlements for reprinting and historical auditing';

-- Disable RLS for synchronization
ALTER TABLE IF EXISTS payroll_history DISABLE ROW LEVEL SECURITY;

-- Index for lookup performance
CREATE INDEX IF NOT EXISTS idx_ph_period ON payroll_history(period_start, period_end);

-- Force schema reload
NOTIFY pgrst, 'reload schema';