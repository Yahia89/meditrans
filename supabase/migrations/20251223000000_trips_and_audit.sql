-- 1. Safely add committed_by to org_uploads (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'org_uploads'
    ) THEN
        ALTER TABLE public.org_uploads ADD COLUMN IF NOT EXISTS committed_by uuid REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Safely create or update upload_source enum
DO $$ 
BEGIN
    -- Create enum if it does not exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'upload_source'
    ) THEN
        CREATE TYPE public.upload_source AS ENUM ('default');
    END IF;

    -- Add 'trips' value if missing
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'upload_source'
          AND enumlabel = 'trips'
    ) THEN
        ALTER TYPE public.upload_source ADD VALUE 'trips';
    END IF;
END $$;

-- 3. Safely update staging_records record_type constraint (only if table exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'staging_records'
    ) THEN
        ALTER TABLE public.staging_records DROP CONSTRAINT IF EXISTS staging_records_record_type_check;
        ALTER TABLE public.staging_records ADD CONSTRAINT staging_records_record_type_check 
        CHECK (record_type = ANY (ARRAY['driver'::text, 'patient'::text, 'employee'::text, 'trip'::text]));
    END IF;
END $$;

-- 4. Create trips table
CREATE TABLE IF NOT EXISTS public.trips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    patient_id uuid REFERENCES public.patients(id),
    driver_id uuid REFERENCES public.drivers(id),
    scheduled_time timestamp with time zone,
    status text DEFAULT 'scheduled' CHECK (status = ANY (ARRAY['scheduled', 'in-progress', 'completed', 'cancelled'])),
    destination text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 5. Enable RLS and add policies for trips
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage trips in their org' AND tablename = 'trips') THEN
        CREATE POLICY "Users can manage trips in their org" ON public.trips
            FOR ALL
            TO public
            USING (is_member_of(org_id))
            WITH CHECK (is_member_of(org_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access' AND tablename = 'trips') THEN
        CREATE POLICY "Service role full access" ON public.trips
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
