-- Migration: Add system_role to employees table and create sync triggers
-- Date: 2026-01-16
-- Purpose: Establish employees table as single source of truth for employee display
-- Note: This migration is designed to be safe - it only runs if the employees table exists

DO $$
BEGIN
  -- Only proceed if employees table exists (it might have been created elsewhere)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) THEN
    RAISE NOTICE 'employees table does not exist, skipping migration';
    RETURN;
  END IF;

  -- 1. Add system_role column to employees table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'system_role'
  ) THEN
    EXECUTE 'ALTER TABLE public.employees ADD COLUMN system_role public.membership_role';
  END IF;

  -- 2. Add email column to organization_memberships if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'organization_memberships' AND column_name = 'email'
  ) THEN
    EXECUTE 'ALTER TABLE public.organization_memberships ADD COLUMN email text';
  END IF;
END $$;

-- 3. Create function to sync role from organization_memberships to employees
CREATE OR REPLACE FUNCTION sync_membership_role_to_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- Update employees table where email matches (only if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
    UPDATE public.employees e
    SET system_role = NEW.role
    FROM auth.users u
    WHERE u.id = NEW.user_id
      AND e.email = u.email
      AND e.org_id = NEW.org_id;
    
    -- Also try to update by user_id if employee is already linked
    UPDATE public.employees
    SET system_role = NEW.role
    WHERE user_id = NEW.user_id
      AND org_id = NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger on organization_memberships (safe - trigger checks table existence in function)
DROP TRIGGER IF EXISTS sync_role_to_employee ON public.organization_memberships;
CREATE TRIGGER sync_role_to_employee
  AFTER INSERT OR UPDATE OF role ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION sync_membership_role_to_employee();

-- 5. Create function to sync role from employees to organization_memberships
CREATE OR REPLACE FUNCTION sync_employee_role_to_membership()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if system_role actually changed
  IF OLD.system_role IS DISTINCT FROM NEW.system_role AND NEW.system_role IS NOT NULL THEN
    -- Update membership if employee has a user_id
    IF NEW.user_id IS NOT NULL THEN
      UPDATE public.organization_memberships
      SET role = NEW.system_role
      WHERE user_id = NEW.user_id
        AND org_id = NEW.org_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger on employees (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS sync_role_to_membership ON public.employees';
    EXECUTE 'CREATE TRIGGER sync_role_to_membership
      AFTER UPDATE OF system_role ON public.employees
      FOR EACH ROW
      EXECUTE FUNCTION sync_employee_role_to_membership()';
  END IF;
END $$;

-- 7. Backfill existing employees (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) THEN
    -- Backfill by user_id
    EXECUTE 'UPDATE public.employees e
      SET system_role = om.role
      FROM public.organization_memberships om
      WHERE e.user_id = om.user_id
        AND e.org_id = om.org_id';

    -- Also backfill by email for employees where user_id isn't linked
    EXECUTE 'UPDATE public.employees e
      SET system_role = om.role
      FROM public.organization_memberships om
      JOIN auth.users u ON u.id = om.user_id
      WHERE e.email = u.email
        AND e.org_id = om.org_id
        AND e.system_role IS NULL';
  END IF;
END $$;

-- 8. Create indexes (only if tables and columns exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'system_role'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS employees_system_role_idx ON public.employees(system_role)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS employees_user_id_idx ON public.employees(user_id)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'organization_memberships' AND column_name = 'email'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS organization_memberships_email_idx ON public.organization_memberships(email)';
  END IF;
END $$;

-- 9. Add dispatch role to membership_role enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'dispatch' AND enumtypid = 'membership_role'::regtype) THEN
    ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'dispatch';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- enum doesn't exist, skip
    NULL;
END $$;

-- 10. Add comment (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'system_role'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN public.employees.system_role IS ''System access role - synced with organization_memberships. Values: owner, admin, dispatch, employee, driver, null (no access)''';
  END IF;
END $$;
