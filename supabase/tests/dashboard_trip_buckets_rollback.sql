-- Synthetic fixtures only; every write rolls back. Run with a local setup role
-- allowed to seed auth.users; all assertions execute as authenticated/anon.
BEGIN;
SET LOCAL statement_timeout = '45s';
SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users(id,email) SELECT
  ('930b0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'dashboard-fixture-'||n||'@example.invalid' FROM generate_series(1,4) n;
INSERT INTO public.organizations(id,name) VALUES
  ('930b0000-0000-4000-8000-000000000100','Dashboard fixture A'),
  ('930b0000-0000-4000-8000-000000000101','Dashboard fixture B');
INSERT INTO public.organization_memberships(org_id,user_id,role) VALUES
  ('930b0000-0000-4000-8000-000000000100','930b0000-0000-4000-8000-000000000001','admin'),
  ('930b0000-0000-4000-8000-000000000100','930b0000-0000-4000-8000-000000000002','driver'),
  ('930b0000-0000-4000-8000-000000000101','930b0000-0000-4000-8000-000000000003','admin'),
  ('930b0000-0000-4000-8000-000000000100','930b0000-0000-4000-8000-000000000004','employee');
INSERT INTO public.drivers(id,org_id,user_id,full_name,active) VALUES
  ('930b0000-0000-4000-8000-000000000200','930b0000-0000-4000-8000-000000000100',
   '930b0000-0000-4000-8000-000000000002','Dashboard fixture driver',true);
-- 1,500 trips would be truncated by a default PostgREST raw-row request.
INSERT INTO public.trips(org_id,status,pickup_time)
SELECT '930b0000-0000-4000-8000-000000000100','completed','2026-09-30 12:00:00+00'
FROM generate_series(1,1500);
INSERT INTO public.trips(org_id,status,pickup_time)
SELECT '930b0000-0000-4000-8000-000000000100',s,'2026-09-30 13:00:00+00'
FROM unnest(ARRAY['assigned','accepted','en_route','arrived','in_pickup_circle',
  'loaded','in_progress','in_dropoff_circle','waiting','pending','cancelled','no_show']) s;
INSERT INTO public.trips(org_id,driver_id,status,pickup_time) VALUES
  ('930b0000-0000-4000-8000-000000000100','930b0000-0000-4000-8000-000000000200','assigned','2026-09-30 14:00:00+00');
INSERT INTO public.trips(org_id,status,pickup_time) VALUES
  ('930b0000-0000-4000-8000-000000000101','completed','2026-09-30 12:00:00+00'),
  -- End boundary must be excluded; before local midnight belongs to prior day.
  ('930b0000-0000-4000-8000-000000000100','completed','2026-10-01 05:00:00+00'),
  ('930b0000-0000-4000-8000-000000000100','completed','2026-09-30 04:59:59+00'),
  -- Fall-back repeated hour aggregates both real instants into local 01:00.
  ('930b0000-0000-4000-8000-000000000100','completed','2026-11-01 06:30:00+00'),
  ('930b0000-0000-4000-8000-000000000100','completed','2026-11-01 07:30:00+00');

CREATE TEMP TABLE dashboard_results(test text,passed boolean);
GRANT ALL ON dashboard_results TO authenticated,anon;
CREATE FUNCTION pg_temp.assert_dashboard(name text,ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Dashboard regression: %',name; END IF;
  INSERT INTO dashboard_results VALUES(name,ok);
END $$;
CREATE FUNCTION pg_temp.expect_dashboard_denial(name text,statement text,expected text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE;
    IF actual=expected THEN PERFORM pg_temp.assert_dashboard(name,true); RETURN; END IF;
    RAISE EXCEPTION 'Unexpected code for %: %',name,actual;
  END;
  RAISE EXCEPTION 'Expected denial: %',name;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"930b0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_dashboard('complete_counts_and_all_active_states',
  count(*)=1 AND bool_and(bucket='2026-09-30' AND total=1513 AND completed=1500
    AND assigned=10 AND pending=1 AND cancelled=1 AND no_show=1))
FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100',
  '2026-09-30 05:00+00','2026-10-01 05:00+00','America/Chicago');
SELECT pg_temp.assert_dashboard('timezone_midnight',
  count(*)=2 AND sum(total)=1514 AND count(*) FILTER(WHERE bucket='2026-09-29' AND total=1)=1)
FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100',
  '2026-09-30 00:00+00','2026-10-01 00:00+00','America/Chicago');
SELECT pg_temp.assert_dashboard('dst_repeated_hour',count(*)=1 AND bool_and(bucket='2026-11-01 01:00' AND total=2))
FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100',
  '2026-11-01 05:00+00','2026-11-02 06:00+00','America/Chicago','hour');
SELECT pg_temp.assert_dashboard('empty_range',count(*)=0)
FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100',
  '2026-08-01','2026-08-02','UTC');
SELECT pg_temp.expect_dashboard_denial('cross_org',
  $$SELECT * FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000101','2026-09-30','2026-10-01','UTC')$$,'42501');
SELECT pg_temp.expect_dashboard_denial('invalid_timezone',
  $$SELECT * FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100','2026-09-30','2026-10-01','Invalid/Zone')$$,'22023');
SELECT pg_temp.expect_dashboard_denial('excessive_range',
  $$SELECT * FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100','2026-01-01','2026-12-01','UTC')$$,'22023');
SELECT pg_temp.expect_dashboard_denial('unbounded_timestamp',
  $$SELECT * FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100','2026-09-30','infinity','UTC')$$,'22023');
SELECT pg_temp.expect_dashboard_denial('excessive_hour_range',
  $$SELECT * FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100','2026-09-01','2026-10-01','UTC','hour')$$,'22023');
SELECT pg_temp.expect_dashboard_denial('invalid_granularity',
  $$SELECT * FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100','2026-09-30','2026-10-01','UTC','week')$$,'22023');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"930b0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_dashboard('driver_rls_only_own_trip',sum(total)=1 AND sum(assigned)=1)
FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100',
  '2026-09-30','2026-10-01','UTC');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"930b0000-0000-4000-8000-000000000004","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_dashboard('employee_rls_not_bypassed',count(*)=0)
FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100',
  '2026-09-30','2026-10-01','UTC');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_dashboard_denial('anonymous_execute_denied',
  $$SELECT * FROM public.dashboard_trip_buckets('930b0000-0000-4000-8000-000000000100','2026-09-30','2026-10-01','UTC')$$,'42501');
RESET ROLE;
SELECT count(*) AS checks,count(*) FILTER(WHERE passed) AS passed FROM dashboard_results;
ROLLBACK;
