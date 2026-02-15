-- Migration: Add Service Agreements and SFTP config for automated billing
-- Date: 2026-02-15

-- 1. Create Service Agreements table
CREATE TABLE IF NOT EXISTS billing_service_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  agreement_number VARCHAR(50) NOT NULL, -- The PA Number
  effective_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  diagnosis_code VARCHAR(10), -- Primary diagnosis for this authorization
  total_units_authorized DECIMAL(12,2),
  total_amount_authorized DECIMAL(12,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_agreement_status CHECK (status IN ('pending', 'active', 'expired', 'archived'))
);

-- 2. Create Service Agreement Lines table
CREATE TABLE IF NOT EXISTS billing_service_agreement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES billing_service_agreements(id) ON DELETE CASCADE,
  hcpcs_code VARCHAR(10) NOT NULL,
  modifier VARCHAR(10),
  units_authorized DECIMAL(12,2),
  units_used DECIMAL(12,2) DEFAULT 0,
  unit_rate DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add SFTP and Batch Submission fields to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS sftp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sftp_host TEXT,
ADD COLUMN IF NOT EXISTS sftp_username TEXT,
ADD COLUMN IF NOT EXISTS sftp_password_enc TEXT,
ADD COLUMN IF NOT EXISTS sftp_port INTEGER DEFAULT 22,
ADD COLUMN IF NOT EXISTS mn_its_submitter_id TEXT;

-- 4. Create Billing Response Logs for tracking 999/835 ingestion
CREATE TABLE IF NOT EXISTS billing_response_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL, -- '999', '277CA', '835'
  raw_content TEXT,
  status VARCHAR(20) DEFAULT 'processed',
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bsa_patient ON billing_service_agreements(patient_id);
CREATE INDEX IF NOT EXISTS idx_bsa_org ON billing_service_agreements(org_id);
CREATE INDEX IF NOT EXISTS idx_bsal_agreement ON billing_service_agreement_lines(agreement_id);
CREATE INDEX IF NOT EXISTS idx_brl_org ON billing_response_logs(org_id);
