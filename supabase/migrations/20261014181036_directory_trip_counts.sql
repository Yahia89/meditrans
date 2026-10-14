-- Legacy PostgREST trips(count) counts the whole trips composite row. That
-- materializes wide/toasted fields (including signatures) for every trip.
-- Count rows once per directory instead, without blocking the base list.
CREATE OR REPLACE FUNCTION public.directory_trip_counts(
  p_org_id uuid,
  p_directory text
)
RETURNS TABLE(entity_id uuid, total_trips bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization is required' USING ERRCODE = '22023';
  END IF;

  IF p_directory = 'patients' THEN
    RETURN QUERY
      SELECT t.patient_id, count(*)
      FROM public.trips AS t
      JOIN public.patients AS p ON p.id = t.patient_id
      WHERE p.org_id = p_org_id
      GROUP BY t.patient_id;
  ELSIF p_directory = 'drivers' THEN
    RETURN QUERY
      SELECT t.driver_id, count(*)
      FROM public.trips AS t
      JOIN public.drivers AS d ON d.id = t.driver_id
      WHERE d.org_id = p_org_id
      GROUP BY t.driver_id;
  ELSE
    RAISE EXCEPTION 'Directory must be patients or drivers' USING ERRCODE = '22023';
  END IF;
END;
$function$;

-- The parent join deliberately matches the original embedded relationship.
-- Both tables retain their existing RLS; this function does not elevate access.
REVOKE ALL ON FUNCTION public.directory_trip_counts(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.directory_trip_counts(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.directory_trip_counts(uuid, text) IS
  'RLS-preserving directory trip totals using count(*) without materializing trip payloads; omitted entities have zero visible trips.';

NOTIFY pgrst, 'reload schema';
