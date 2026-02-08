-- Migration: Expand organization_fees with specific wheelchair types and custom charges
-- Date: 2026-02-07

-- Add columns for Foldable Wheelchair
ALTER TABLE public.organization_fees 
ADD COLUMN IF NOT EXISTS foldable_wheelchair_base_fee NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS foldable_wheelchair_per_mile_fee NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS foldable_wheelchair_deadhead_fee NUMERIC(10, 2) DEFAULT 0.00;

-- Ensure standardized naming for Standard Wheelchair (renaming or adding new)
-- Since the UI used deadhead_per_mile_wheelchair, we'll keep consistent or add standard ones
ALTER TABLE public.organization_fees
ADD COLUMN IF NOT EXISTS wheelchair_deadhead_fee NUMERIC(10, 2) DEFAULT 0.00;

-- Add columns for Ramp Van
ALTER TABLE public.organization_fees
ADD COLUMN IF NOT EXISTS ramp_van_base_fee NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS ramp_van_per_mile_fee NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS ramp_van_deadhead_fee NUMERIC(10, 2) DEFAULT 0.00;

-- Add Custom Charges (JSONB array)
ALTER TABLE public.organization_fees
ADD COLUMN IF NOT EXISTS custom_charges JSONB DEFAULT '[]'::jsonb;

-- Move data from old deadhead col if it exists and we want to transition
-- (Wait, the UI used deadhead_per_mile_wheelchair, so let's keep it or migrate it)
UPDATE public.organization_fees 
SET wheelchair_deadhead_fee = COALESCE(wheelchair_deadhead_fee, 0.00);

-- Also add columns that might be missing based on UI (base_fee, per_mile_fee, wheelchair_base_fee, wheelchair_per_mile_fee, wait_time_free_minutes, wait_time_hourly_rate, etc already exist in some form)
-- Let's ensure all columns used in FeeSettingsPage.tsx are present
ALTER TABLE public.organization_fees
ADD COLUMN IF NOT EXISTS deadhead_per_mile_ambulatory NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS wait_time_free_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS wait_time_hourly_rate NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES auth.users(id);
