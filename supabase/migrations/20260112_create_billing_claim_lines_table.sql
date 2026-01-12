-- Migration: Create billing_claim_lines table
-- Date: 2026-01-12
-- Description: Individual line items (HCPCS codes) for each claim

CREATE TABLE IF NOT EXISTS billing_claim_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES billing_claims(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trips(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  driver_id UUID REFERENCES drivers(id),
  service_date DATE NOT NULL,
  hcpcs_code VARCHAR(10) NOT NULL,
  modifier VARCHAR(10),
  units DECIMAL(8,2) NOT NULL,
  charge_amount DECIMAL(10,2) NOT NULL,
  diagnosis_code VARCHAR(10) NOT NULL DEFAULT 'Z02.9',
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_line_status CHECK (status IN ('pending', 'included', 'excluded', 'rejected'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_claim_lines_claim_id ON billing_claim_lines(claim_id);
CREATE INDEX IF NOT EXISTS idx_billing_claim_lines_trip_id ON billing_claim_lines(trip_id);
CREATE INDEX IF NOT EXISTS idx_billing_claim_lines_patient_id ON billing_claim_lines(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_claim_lines_service_date ON billing_claim_lines(service_date);

-- Prevent duplicate billing
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_trip_billing 
ON billing_claim_lines(trip_id, hcpcs_code) 
WHERE status = 'included';

COMMENT ON TABLE billing_claim_lines IS 'Individual service lines (HCPCS codes) for 837P claims';
COMMENT ON COLUMN billing_claim_lines.hcpcs_code IS 'HCPCS procedure code (A0130, S0209, etc)';
COMMENT ON COLUMN billing_claim_lines.units IS 'Quantity billed (miles for mileage codes, 1 for base)';
COMMENT ON COLUMN billing_claim_lines.diagnosis_code IS 'ICD-10 code (default Z02.9 for NEMT)';
