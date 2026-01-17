-- Migration: Add provider IDs to drivers table
-- Date: 2026-01-12
-- Description: Adds UMPI and NPI for rendering provider loop in 837P

ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS umpi VARCHAR(20),
ADD COLUMN IF NOT EXISTS npi VARCHAR(10);

COMMENT ON COLUMN drivers.umpi IS 'Unique Minnesota Provider Identifier (required for MN Medicaid)';
COMMENT ON COLUMN drivers.npi IS 'National Provider Identifier (optional, for non-MN states)';
