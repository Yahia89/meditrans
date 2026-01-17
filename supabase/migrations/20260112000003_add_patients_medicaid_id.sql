-- Migration: Add Medicaid ID to patients table
-- Date: 2026-01-12
-- Description: Adds Medicaid subscriber ID for 837P subscriber loop

ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS medicaid_id VARCHAR(20);

COMMENT ON COLUMN patients.medicaid_id IS 'State Medicaid ID (e.g., MN123456789 for Minnesota)';
