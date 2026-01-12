-- Migration: Add Medicaid billing fields to organizations table
-- Date: 2026-01-12
-- Description: Adds NPI, Tax ID, and billing configuration fields for Medicaid 837P claims

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS npi VARCHAR(10),
ADD COLUMN IF NOT EXISTS tax_id VARCHAR(11),
ADD COLUMN IF NOT EXISTS billing_state VARCHAR(2) DEFAULT 'MN',
ADD COLUMN IF NOT EXISTS billing_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN organizations.npi IS 'National Provider Identifier for billing provider loop in 837P';
COMMENT ON COLUMN organizations.tax_id IS 'Federal Tax ID (EIN) for organization';
COMMENT ON COLUMN organizations.billing_state IS 'Primary state for Medicaid billing (MN, CA, etc)';
COMMENT ON COLUMN organizations.billing_enabled IS 'Whether Medicaid billing is enabled for this organization';
