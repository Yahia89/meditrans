-- Migration: Backfill email column in organization_memberships  
-- Date: 2026-01-16
-- Purpose: Populate email for existing membership records
-- Note: Safe migration - checks table existence before operations

-- Backfill email from auth.users for existing memberships where email is null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'organization_memberships' AND column_name = 'email'
  ) THEN
    -- Backfill from auth.users
    EXECUTE 'UPDATE public.organization_memberships om
      SET email = u.email
      FROM auth.users u
      WHERE om.user_id = u.id
        AND om.email IS NULL';

    -- Backfill from employees if table exists  
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'employees'
    ) THEN
      EXECUTE 'UPDATE public.organization_memberships om
        SET email = e.email
        FROM public.employees e
        WHERE om.user_id = e.user_id
          AND om.org_id = e.org_id
          AND om.email IS NULL
          AND e.email IS NOT NULL';
    END IF;

    -- Backfill from drivers if table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'drivers'
    ) THEN
      EXECUTE 'UPDATE public.organization_memberships om
        SET email = d.email
        FROM public.drivers d
        WHERE om.user_id = d.user_id
          AND om.org_id = d.org_id
          AND om.email IS NULL
          AND d.email IS NOT NULL';
    END IF;

    EXECUTE 'COMMENT ON COLUMN public.organization_memberships.email IS ''User email for easier lookups without joining auth.users''';
  END IF;
END $$;
