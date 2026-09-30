-- Return aggregate chart/calendar data without downloading every trip or
-- truncating totals at the Data API row limit. Existing trip RLS remains active.
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
  IF p_timezone IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_timezone
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid dashboard timezone';
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

REVOKE ALL ON FUNCTION public.dashboard_trip_buckets(uuid, timestamptz, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_trip_buckets(uuid, timestamptz, timestamptz, text, text) TO authenticated;
COMMENT ON FUNCTION public.dashboard_trip_buckets(uuid, timestamptz, timestamptz, text, text) IS
  'Organization and RLS scoped trip counts by local day/hour over a bounded half-open timestamp range.';

-- The pickup range already has idx_trips_org_id_pickup_time. Recent Activity
-- needs a separate ordering index so fetching its six latest rows avoids sorting.
CREATE INDEX IF NOT EXISTS idx_trips_org_updated_at ON public.trips (org_id, updated_at DESC);
