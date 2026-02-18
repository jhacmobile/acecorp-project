
-- ACEGAS ENTERPRISE - HR & BANDI SCHEMA UPDATES (V1.5.0)
-- Run this in your Supabase SQL Editor to resolve "column not found" errors.

BEGIN;

-- 1. Update Attendance Table
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist for existing attendance table
ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS late_minutes NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS undertime_minutes NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS overtime_minutes NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT FALSE;

-- 2. Update Employees Table for Financials & Shifts
ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS shift_start TEXT DEFAULT '08:00';
ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS shift_end TEXT DEFAULT '17:00';
ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS loan_balance NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS vale_balance NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS employees ADD COLUMN IF NOT EXISTS loan_terms TEXT DEFAULT '0';

-- 3. Disable RLS for synchronized tables (System standard)
ALTER TABLE IF EXISTS attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employees DISABLE ROW LEVEL SECURITY;

COMMIT;

-- Force a PostgREST cache reload
NOTIFY pgrst, 'reload schema';
