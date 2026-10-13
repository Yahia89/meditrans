-- READ-ONLY diagnostic template. It does not change schema, policies or data.
-- Run in a private terminal against a verified local/staging database with
-- representative data and the same RLS policies as the application project.
-- An operator connection may SET ROLE, but every measured SELECT below executes
-- as authenticated with the chosen user's claims; do not substitute postgres
-- or service_role execution for the measured statements.
--
-- Example (supply the connection through a private env/pgpass, never commit it):
-- psql "$NEMT_PROFILE_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
--   -v user_id='REPRESENTATIVE_USER_UUID' -v org_id='THEIR_ORGANIZATION_UUID' \
--   -v start_at='2026-10-07T05:00:00Z' -v end_at='2026-10-14T05:00:00Z' \
--   -v timezone='America/Chicago' -v granularity='day' \
--   -f reports/startup/database-profile.sql
--
-- Repeat separately for performance and calendar ranges, then driver and
-- restricted-employee users. Also cover 23/25-hour local days and >1,000 trips.
-- Keep raw plans private: EXPLAIN can include user/tenant IDs and literals.
-- Export only sanitized plan shape, timings, buffers and row counts.

\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';

-- Confirm actual indexes rather than trusting a migration comment/name. A
-- differently named equivalent index is sufficient: do not create a duplicate.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('trips', 'organization_memberships', 'drivers')
ORDER BY tablename, indexname;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('trips', 'organization_memberships', 'drivers');

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('trips', 'organization_memberships', 'drivers')
ORDER BY tablename, policyname;

-- Verify the deployed RPC remains STABLE SECURITY INVOKER and has its expected
-- fixed search_path. Read its definition privately if it differs from the repo.
SELECT p.proname, p.prosecdef AS security_definer, p.provolatile, p.proconfig
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'dashboard_trip_buckets';

SELECT pg_catalog.set_config('request.jwt.claims',
  json_build_object('sub', :'user_id', 'role', 'authenticated')::text, true)
  IS NOT NULL AS claims_configured;
SET LOCAL ROLE authenticated;

-- Fail closed: confirm the effective role and supplied claim agree before
-- accepting any plan as authenticated evidence. No patient/trip rows printed.
SELECT current_user = 'authenticated' AS authenticated_role,
       auth.uid() = :'user_id'::uuid AS matching_user,
       EXISTS (SELECT 1 FROM public.organization_memberships m
         WHERE m.user_id = auth.uid() AND m.org_id = :'org_id'::uuid)
         AS membership_visible;

-- A false or null precondition raises division_by_zero, stopping psql through
-- ON_ERROR_STOP before any plan can be mistaken for authenticated evidence.
SELECT 1 / COALESCE(
  current_user = 'authenticated'
  AND auth.uid() = :'user_id'::uuid
  AND EXISTS (SELECT 1 FROM public.organization_memberships m
    WHERE m.user_id = auth.uid() AND m.org_id = :'org_id'::uuid)
  AND current_setting('transaction_read_only') = 'on'
  AND current_setting('row_security') = 'on'
  AND NOT (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = current_user),
  false)::integer AS authenticated_preconditions_verified;

-- End-to-end SQL execution including the function's validation checks.
-- PL/pgSQL's Function Scan does not expose its nested aggregate plan, which is
-- why the identical SELECT body is also profiled below under the same role.
EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
SELECT * FROM public.dashboard_trip_buckets(
  :'org_id'::uuid, :'start_at'::timestamptz, :'end_at'::timestamptz,
  :'timezone', :'granularity');

-- Matches the aggregate SELECT in 20260930190614_dashboard_trip_buckets.sql.
-- User RLS stays enabled; local-time formatting occurs after indexable UTC range
-- filtering. Never wrap pickup_time in a function in the WHERE clause.
EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
SELECT
  to_char(t.pickup_time AT TIME ZONE :'timezone',
    CASE :'granularity' WHEN 'hour' THEN 'YYYY-MM-DD HH24:00' ELSE 'YYYY-MM-DD' END),
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
WHERE t.org_id = :'org_id'::uuid
  AND t.pickup_time >= :'start_at'::timestamptz
  AND t.pickup_time < :'end_at'::timestamptz
GROUP BY 1 ORDER BY 1;

-- Recent activity has a different access pattern and an existing additive
-- (org_id, updated_at DESC) index; inspect this independently of pickup ranges.
EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON)
SELECT id, status, updated_at, pickup_location, dropoff_location
FROM public.trips
WHERE org_id = :'org_id'::uuid
ORDER BY updated_at DESC
LIMIT 5;

ROLLBACK;
