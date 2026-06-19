-- Enforce access-disabled records at the trip boundary.
-- UI selectors mirror this, but the database owns the invariant for imports,
-- broker sync, and any future write path.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.prevent_disabled_trip_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  disabled_patient_name text;
  inactive_driver_name text;
BEGIN
  IF NEW.patient_id IS NOT NULL THEN
    SELECT p.full_name
    INTO disabled_patient_name
    FROM public.patients p
    WHERE p.id = NEW.patient_id
      AND p.disabled = true;

    IF disabled_patient_name IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot create or update trip for disabled patient "%".', disabled_patient_name
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.driver_id IS NOT NULL THEN
    SELECT d.full_name
    INTO inactive_driver_name
    FROM public.drivers d
    WHERE d.id = NEW.driver_id
      AND d.active = false;

    IF inactive_driver_name IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot assign disabled driver "%".', inactive_driver_name
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_disabled_trip_assignments() FROM anon, authenticated;

DROP TRIGGER IF EXISTS prevent_disabled_trip_assignments_trigger ON public.trips;

CREATE TRIGGER prevent_disabled_trip_assignments_trigger
BEFORE INSERT OR UPDATE OF patient_id, driver_id ON public.trips
FOR EACH ROW
EXECUTE FUNCTION private.prevent_disabled_trip_assignments();
