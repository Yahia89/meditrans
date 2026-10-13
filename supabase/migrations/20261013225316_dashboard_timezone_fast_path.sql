-- PREPARED ONLY: not applied during the startup optimization work.
-- Profiling found the exact pg_timezone_names validation takes ~788ms while
-- the indexed aggregate takes ~4-7ms. Skip catalog enumeration only for the
-- verified canonical default; preserve the fallback and all existing guards.
-- CREATE OR REPLACE retains the existing function grants. No grants, policies,
-- indexes, other schema objects or aggregation behavior are changed here.
-- Before deployment, run supabase/tests/dashboard_trip_buckets_rollback.sql
-- against a disposable database with representative schema/RLS.

CREATE OR REPLACE FUNCTION public.dashboard_trip_buckets(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_timezone text,
  p_granularity text DEFAULT 'day'
)
RETURNS TABLE (
  bucket text,
  total bigint,
  completed bigint,
  assigned bigint,
  pending bigint,
  cancelled bigint,
  no_show bigint
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication is required';
  END IF;
  IF p_org_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.org_id = p_org_id AND m.user_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Organization membership is required';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end)
     OR p_end <= p_start OR p_end - p_start > interval '62 days'
     OR p_granularity IS NULL OR p_granularity NOT IN ('day', 'hour')
     OR (p_granularity = 'hour' AND p_end - p_start > interval '2 days') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid dashboard time range or granularity';
  END IF;
  -- This exact canonical name was verified against the target catalog.
  -- All other names keep the original case-sensitive catalog validation.
  -- Nested branches guarantee the fast path never enumerates the catalog.
  IF p_timezone IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid dashboard timezone';
  ELSIF p_timezone <> 'America/Chicago' THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_timezone
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid dashboard timezone';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    to_char(t.pickup_time AT TIME ZONE p_timezone,
      CASE p_granularity WHEN 'hour' THEN 'YYYY-MM-DD HH24:00' ELSE 'YYYY-MM-DD' END),
    count(*),
    count(*) FILTER (WHERE t.status = 'completed'),
    count(*) FILTER (WHERE t.status IN (
      'assigned', 'accepted', 'en_route', 'arrived', 'in_pickup_circle',
      'loaded', 'in_progress', 'in_dropoff_circle', 'waiting'
    )),
    count(*) FILTER (WHERE t.status = 'pending'),
    count(*) FILTER (WHERE t.status = 'cancelled'),
    count(*) FILTER (WHERE t.status = 'no_show')
  FROM public.trips t
  WHERE t.org_id = p_org_id AND t.pickup_time >= p_start AND t.pickup_time < p_end
  GROUP BY 1 ORDER BY 1;
END;
$$;
