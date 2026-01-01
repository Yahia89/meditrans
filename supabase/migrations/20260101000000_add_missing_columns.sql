-- Migration: Add missing columns to drivers and update patients table columns
-- Date: 2026-01-01

-- 1. Add notes column to drivers table (it was missing)
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS notes text;

-- 2. Add/rename patient columns to match the new naming convention
-- New columns matching: CLIENT NAME, DOB, PHONE NUMBER, ADDRESS, WAIVER TYPE, COUNTY, 
-- REFERRAL BY, MONTHLY CREDIT, CASE MANAGER NAME, SERVICE TYPE, CASE MANAGER PHONE, 
-- CASE MANAGER EMAIL, VEHICLE NEED, REFERRAL EXPIRATION, NOTES

-- full_name -> client_name (keeping full_name as alias)
-- dob already exists as date_of_birth
-- phone already exists
-- primary_address already exists
-- waiver_type needs to be added if not exists
-- county needs to be added if not exists
-- referral_by needs to be added if not exists
-- monthly_credit needs to be added if not exists
-- case_manager (case_manager_name) needs to be added if not exists
-- service_type needs to be added if not exists
-- case_manager_phone needs to be added if not exists
-- case_manager_email needs to be added (NEW)
-- vehicle_type_need -> vehicle_need (keeping vehicle_type_need as alias)
-- referral_expiration_date -> referral_expiration (keeping as alias)
-- notes already exists

-- Add new patient columns
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS dob date;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS waiver_type text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS referral_by text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS referral_date date;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS referral_expiration_date date;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS service_type text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS case_manager text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS case_manager_phone text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS case_manager_email text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS monthly_credit numeric(10,2);
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS credit_used_for text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS vehicle_type_need text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS custom_fields jsonb;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Add missing driver columns from the form
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS id_number text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS county text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_type text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_make text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_model text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_color text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS license_plate text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS dot_medical_number text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS dot_medical_expiration date;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS insurance_company text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS insurance_policy_number text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS insurance_start_date date;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS insurance_expiration_date date;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS inspection_date date;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS driver_record_issue_date date;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS driver_record_expiration date;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS custom_fields jsonb;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';

-- Add vehicle type constraint for patients if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'patients_vehicle_type_need_check'
    ) THEN
        ALTER TABLE public.patients ADD CONSTRAINT patients_vehicle_type_need_check 
        CHECK (vehicle_type_need IS NULL OR vehicle_type_need = ANY(ARRAY['COMMON CARRIER', 'FOLDED WHEELCHAIR', 'WHEELCHAIR', 'VAN']));
    END IF;
END $$;

-- Add vehicle type constraint for drivers if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'drivers_vehicle_type_check'
    ) THEN
        ALTER TABLE public.drivers ADD CONSTRAINT drivers_vehicle_type_check 
        CHECK (vehicle_type IS NULL OR vehicle_type = ANY(ARRAY['COMMON CARRIER', 'FOLDED WHEELCHAIR', 'WHEELCHAIR', 'VAN']));
    END IF;
END $$;
