-- Migration: Add signature capture fields to trips table
-- Date: 2026-01-06
-- Purpose: Enable patient/rider signature capture upon trip completion for transparency and auditing

-- Add signature-related columns to trips table
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS signature_captured_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS signed_by_name TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS signature_declined BOOLEAN DEFAULT FALSE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS signature_declined_reason TEXT;

-- Add index for quick signature audits
CREATE INDEX IF NOT EXISTS idx_trips_signature_captured_at ON public.trips (signature_captured_at) WHERE signature_captured_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.trips.signature_data IS 'Base64 encoded PNG signature image from patient/rider';
COMMENT ON COLUMN public.trips.signature_captured_at IS 'Timestamp when signature was captured';
COMMENT ON COLUMN public.trips.signed_by_name IS 'Name of the person who provided the signature';
COMMENT ON COLUMN public.trips.signature_declined IS 'Whether the patient declined to sign';
COMMENT ON COLUMN public.trips.signature_declined_reason IS 'Reason for declining signature if applicable';
