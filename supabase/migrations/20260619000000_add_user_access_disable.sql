-- Temporary auth access suspension state.
-- Business status fields remain separate from these access-control fields.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disabled_reason text;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disabled_reason text;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS disabled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disabled_reason text;

UPDATE public.drivers
SET active = true
WHERE active IS NULL;

ALTER TABLE public.drivers
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN active SET NOT NULL;

CREATE INDEX IF NOT EXISTS employees_org_user_access_idx
  ON public.employees (org_id, user_id, disabled)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS patients_org_user_access_idx
  ON public.patients (org_id, user_id, disabled)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS drivers_org_user_access_idx
  ON public.drivers (org_id, user_id, active)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS employees_org_disabled_idx
  ON public.employees (org_id, disabled);

CREATE INDEX IF NOT EXISTS patients_org_disabled_idx
  ON public.patients (org_id, disabled);

CREATE INDEX IF NOT EXISTS drivers_org_active_idx
  ON public.drivers (org_id, active);

CREATE INDEX IF NOT EXISTS employees_disabled_by_idx
  ON public.employees (disabled_by)
  WHERE disabled_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS patients_disabled_by_idx
  ON public.patients (disabled_by)
  WHERE disabled_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS drivers_disabled_by_idx
  ON public.drivers (disabled_by)
  WHERE disabled_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_member_of(_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = (SELECT auth.uid())
      AND om.org_id = _org_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.org_id = _org_id
      AND e.user_id = (SELECT auth.uid())
      AND e.disabled = true
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.org_id = _org_id
      AND d.user_id = (SELECT auth.uid())
      AND d.active = false
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.org_id = _org_id
      AND p.user_id = (SELECT auth.uid())
      AND p.disabled = true
  );
$$;

COMMENT ON COLUMN public.employees.disabled IS 'Auth access suspension flag. Separate from employee business status.';
COMMENT ON COLUMN public.patients.disabled IS 'Auth access suspension flag. Separate from patient business or SAL status.';
COMMENT ON COLUMN public.drivers.active IS 'Auth access flag for drivers. false means disabled/suspended.';
