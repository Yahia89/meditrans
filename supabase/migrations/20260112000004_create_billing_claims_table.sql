-- Migration: Create billing_claims table
-- Date: 2026-01-12
-- Description: State machine for Medicaid claim lifecycle

CREATE TABLE IF NOT EXISTS billing_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  claim_control_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  total_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_trips INTEGER NOT NULL DEFAULT 0,
  generated_file_name VARCHAR(255),
  generated_file_data TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  response_status VARCHAR(50),
  response_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(user_id),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'ready', 'validated', 'generated', 'submitted', 'accepted', 'rejected', 'paid'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_claims_org_id ON billing_claims(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_claims_status ON billing_claims(status);
CREATE INDEX IF NOT EXISTS idx_billing_claims_period ON billing_claims(billing_period_start, billing_period_end);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_billing_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_billing_claims_updated_at
  BEFORE UPDATE ON billing_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_claims_updated_at();

COMMENT ON TABLE billing_claims IS 'Medicaid 837P claims with state machine tracking';
COMMENT ON COLUMN billing_claims.claim_control_number IS 'Unique claim identifier for payer (CLM01)';
COMMENT ON COLUMN billing_claims.status IS 'Workflow state: draft → ready → validated → generated → submitted → accepted/rejected → paid';
