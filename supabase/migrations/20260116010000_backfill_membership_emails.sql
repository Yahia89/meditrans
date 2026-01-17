-- Migration: Backfill email column in organization_memberships
-- Date: 2026-01-16
-- Purpose: Populate email for existing membership records

-- Backfill email from auth.users for existing memberships where email is null
UPDATE public.organization_memberships om
SET email = u.email
FROM auth.users u
WHERE om.user_id = u.id
  AND om.email IS NULL;

-- Also backfill from employees table if auth.users doesn't have the email
UPDATE public.organization_memberships om
SET email = e.email
FROM public.employees e
WHERE om.user_id = e.user_id
  AND om.org_id = e.org_id
  AND om.email IS NULL
  AND e.email IS NOT NULL;

-- Backfill from drivers table too
UPDATE public.organization_memberships om
SET email = d.email
FROM public.drivers d
WHERE om.user_id = d.user_id
  AND om.org_id = d.org_id
  AND om.email IS NULL
  AND d.email IS NOT NULL;

COMMENT ON COLUMN public.organization_memberships.email IS 'User email for easier lookups without joining auth.users';
