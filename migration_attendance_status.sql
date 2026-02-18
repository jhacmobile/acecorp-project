-- ACEGAS ENTERPRISE - ATTENDANCE STATUS PATCH (V1.6.0)
-- Adds storage for shift classification (Regular, OB, PTO).

ALTER TABLE IF EXISTS attendance 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'REGULAR';

COMMENT ON COLUMN attendance.status IS 'Shift classification: REGULAR, OB, PTO, or ABSENT';

-- Initialize existing records to REGULAR
UPDATE attendance SET status = 'REGULAR' WHERE status IS NULL;

-- Force schema reload
NOTIFY pgrst, 'reload schema';