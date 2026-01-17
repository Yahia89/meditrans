-- Migration: Add system_role to employees table and create sync triggers
-- Date: 2026-01-16
-- Purpose: Establish employees table as single source of truth for employee display

-- 1. Add system_role column to employees table (uses same enum as organization_memberships)
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS system_role public.membership_role;

-- 2. Add email column to organization_memberships if it doesn't exist
-- This helps with lookups when user_id isn't linked yet
ALTER TABLE public.organization_memberships
ADD COLUMN IF NOT EXISTS email text;

-- 3. Create function to sync role from organization_memberships to employees
-- When a membership role changes, update the corresponding employee record
CREATE OR REPLACE FUNCTION sync_membership_role_to_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- Update employees table where email matches
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger on organization_memberships
DROP TRIGGER IF EXISTS sync_role_to_employee ON public.organization_memberships;
CREATE TRIGGER sync_role_to_employee
  AFTER INSERT OR UPDATE OF role ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION sync_membership_role_to_employee();

-- 5. Create function to sync role from employees to organization_memberships
-- When an employee's system_role is changed directly, update membership
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

-- 6. Create trigger on employees
DROP TRIGGER IF EXISTS sync_role_to_membership ON public.employees;
CREATE TRIGGER sync_role_to_membership
  AFTER UPDATE OF system_role ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION sync_employee_role_to_membership();

-- 7. Backfill existing employees with their current system_role from organization_memberships
-- This one-time update populates the new column with existing data
UPDATE public.employees e
SET system_role = om.role
FROM public.organization_memberships om
WHERE e.user_id = om.user_id
  AND e.org_id = om.org_id;

-- Also backfill by email for employees where user_id isn't linked
UPDATE public.employees e
SET system_role = om.role
FROM public.organization_memberships om
JOIN auth.users u ON u.id = om.user_id
WHERE e.email = u.email
  AND e.org_id = om.org_id
  AND e.system_role IS NULL;

-- 8. Create index for performance
CREATE INDEX IF NOT EXISTS employees_system_role_idx ON public.employees(system_role);
CREATE INDEX IF NOT EXISTS employees_user_id_idx ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS organization_memberships_email_idx ON public.organization_memberships(email);

-- 9. Add dispatch role to membership_role enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'dispatch' AND enumtypid = 'membership_role'::regtype) THEN
    ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'dispatch';
  END IF;
END $$;

COMMENT ON COLUMN public.employees.system_role IS 'System access role - synced with organization_memberships. Values: owner, admin, dispatch, employee, driver, null (no access)';
