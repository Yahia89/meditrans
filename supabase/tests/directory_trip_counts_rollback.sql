-- Synthetic fixtures only; every write rolls back. Never run on production.
-- Apply the candidate migration to a disposable local/staging database first.
-- The setup role must be allowed to seed auth.users and temporarily skip
-- business triggers. Assertions use authenticated/anon and the real table RLS.
BEGIN;
SET LOCAL statement_timeout = '45s';
SET LOCAL session_replication_role = 'replica';

INSERT INTO auth.users(id,email)
SELECT ('941c0000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'directory-count-fixture-' || n || '@example.invalid'
FROM generate_series(1,10) n;
INSERT INTO public.organizations(id,name) VALUES
  ('941c0000-0000-4000-8000-000000000100','Directory count fixture A'),
  ('941c0000-0000-4000-8000-000000000101','Directory count fixture B');
INSERT INTO public.organization_memberships(org_id,user_id,role) VALUES
  ('941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000001','admin'),
  ('941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000002','driver'),
  ('941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000003','patient'),
  ('941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000004','employee'),
  ('941c0000-0000-4000-8000-000000000101','941c0000-0000-4000-8000-000000000005','admin'),
  ('941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000006','admin'),
  ('941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000007','driver'),
  ('941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000008','patient'),
  ('941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000010','admin'),
  ('941c0000-0000-4000-8000-000000000101','941c0000-0000-4000-8000-000000000010','admin');

INSERT INTO public.drivers(id,org_id,user_id,full_name,active) VALUES
  ('941c0000-0000-4000-8000-000000000200','941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000002','Directory fixture main driver',true),
  ('941c0000-0000-4000-8000-000000000201','941c0000-0000-4000-8000-000000000100',NULL,'Directory fixture other driver',true),
  ('941c0000-0000-4000-8000-000000000202','941c0000-0000-4000-8000-000000000100',NULL,'Directory fixture zero trip driver',true),
  ('941c0000-0000-4000-8000-000000000203','941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000007','Directory fixture disabled driver',false),
  ('941c0000-0000-4000-8000-000000000210','941c0000-0000-4000-8000-000000000101',NULL,'Directory fixture foreign driver',true);
INSERT INTO public.patients(id,org_id,user_id,full_name,disabled) VALUES
  ('941c0000-0000-4000-8000-000000000300','941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000003','Directory fixture main patient',false),
  ('941c0000-0000-4000-8000-000000000301','941c0000-0000-4000-8000-000000000100',NULL,'Directory fixture other patient',false),
  ('941c0000-0000-4000-8000-000000000302','941c0000-0000-4000-8000-000000000100',NULL,'Directory fixture zero trip patient',false),
  ('941c0000-0000-4000-8000-000000000303','941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000008','Directory fixture disabled patient',true),
  ('941c0000-0000-4000-8000-000000000310','941c0000-0000-4000-8000-000000000101',NULL,'Directory fixture foreign patient',false);
INSERT INTO public.employees(id,org_id,user_id,full_name,disabled) VALUES
  ('941c0000-0000-4000-8000-000000000400','941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000006','Directory fixture disabled admin',true);

-- Exceeds the default 1,000-row PostgREST ceiling without fetching raw trips.
INSERT INTO public.trips(org_id,patient_id,driver_id,status,pickup_time)
SELECT '941c0000-0000-4000-8000-000000000100',
  '941c0000-0000-4000-8000-000000000300',
  '941c0000-0000-4000-8000-000000000200','completed','2026-10-14 12:00+00'
FROM generate_series(1,1505);
INSERT INTO public.trips(org_id,patient_id,driver_id,status,pickup_time) VALUES
  ('941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000301','941c0000-0000-4000-8000-000000000201','assigned','2026-10-14 13:00+00'),
  ('941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000301','941c0000-0000-4000-8000-000000000201','cancelled','2026-10-14 14:00+00'),
  -- Existing history remains countable by an authorized administrator even
  -- when the linked driver/patient has since been disabled.
  ('941c0000-0000-4000-8000-000000000100','941c0000-0000-4000-8000-000000000303','941c0000-0000-4000-8000-000000000203','completed','2026-10-14 15:00+00'),
  ('941c0000-0000-4000-8000-000000000101','941c0000-0000-4000-8000-000000000310','941c0000-0000-4000-8000-000000000210','completed','2026-10-14 16:00+00'),
  -- Deliberately inconsistent fixture: legacy embedding joins by parent ID,
  -- while trip RLS independently determines which child rows are visible.
  ('941c0000-0000-4000-8000-000000000101','941c0000-0000-4000-8000-000000000300','941c0000-0000-4000-8000-000000000200','completed','2026-10-14 17:00+00'),
  -- Unlinked trips must not appear as a NULL directory entity.
  ('941c0000-0000-4000-8000-000000000100',NULL,NULL,'pending','2026-10-14 18:00+00');
SET LOCAL session_replication_role = 'origin';

CREATE TEMP TABLE directory_count_results(test text,passed boolean);
GRANT ALL ON directory_count_results TO authenticated,anon;
CREATE FUNCTION pg_temp.assert_directory_counts(name text,ok boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Directory count regression: %',name;
  END IF;
  INSERT INTO directory_count_results VALUES(name,ok);
END $$;
CREATE FUNCTION pg_temp.expect_directory_error(name text,statement text,expected text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE;
    IF actual=expected THEN
      PERFORM pg_temp.assert_directory_counts(name,true);
      RETURN;
    END IF;
    RAISE EXCEPTION 'Unexpected code for %: %',name,actual;
  END;
  RAISE EXCEPTION 'Expected error: %',name;
END $$;

-- The exact legacy aggregate is t.count = count(t), not count(*). Compare
-- under the caller's RLS and normalize omitted RPC rows to zero for display.
CREATE FUNCTION pg_temp.assert_directory_legacy(name text,org uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE directory text; matches boolean;
BEGIN
  FOREACH directory IN ARRAY ARRAY['patients','drivers'] LOOP
    EXECUTE format($query$
      WITH legacy AS (
        SELECT p.id,(SELECT t.count FROM public.trips t WHERE t.%I=p.id) AS total
        FROM public.%I p WHERE p.org_id=$1
      ), actual AS (
        SELECT * FROM public.directory_trip_counts($1,$2)
      )
      SELECT NOT EXISTS (
        SELECT 1 FROM legacy l FULL JOIN actual a ON a.entity_id=l.id
        WHERE l.id IS NULL OR coalesce(l.total,0)<>coalesce(a.total_trips,0)
          OR a.total_trips<=0
      )
    $query$,CASE directory WHEN 'patients' THEN 'patient_id' ELSE 'driver_id' END,directory)
    INTO matches USING org,directory;
    PERFORM pg_temp.assert_directory_counts(name || '_' || directory,matches);
  END LOOP;
END $$;
CREATE FUNCTION pg_temp.assert_directory_empty(name text,org uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE directory text; actual bigint;
BEGIN
  FOREACH directory IN ARRAY ARRAY['patients','drivers'] LOOP
    SELECT count(*) INTO actual FROM public.directory_trip_counts(org,directory);
    PERFORM pg_temp.assert_directory_counts(name || '_' || directory,actual=0);
  END LOOP;
END $$;

SELECT pg_temp.assert_directory_counts('stable_invoker_and_empty_search_path',
  NOT prosecdef AND provolatile='s'
  AND EXISTS (SELECT 1 FROM unnest(proconfig) config WHERE config IN ('search_path=""','search_path=')))
FROM pg_proc WHERE oid='public.directory_trip_counts(uuid,text)'::regprocedure;
SELECT pg_temp.assert_directory_counts('return_signature',
  pg_get_function_result('public.directory_trip_counts(uuid,text)'::regprocedure)
    ='TABLE(entity_id uuid, total_trips bigint)');
SELECT pg_temp.assert_directory_counts('execute_acl',
  has_function_privilege('authenticated','public.directory_trip_counts(uuid,text)','EXECUTE')
  AND has_function_privilege('service_role','public.directory_trip_counts(uuid,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.directory_trip_counts(uuid,text)','EXECUTE')
  AND NOT EXISTS (
    SELECT 1 FROM pg_proc p,aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
    WHERE p.oid='public.directory_trip_counts(uuid,text)'::regprocedure
      AND acl.grantee=0 AND acl.privilege_type='EXECUTE'));

SELECT set_config('request.jwt.claims','{"sub":"941c0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_directory_counts('admin_patients_complete_counts',
  count(*)=3 AND sum(total_trips)=1508
  AND count(*) FILTER(WHERE entity_id='941c0000-0000-4000-8000-000000000300' AND total_trips=1505)=1)
FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100','patients');
SELECT pg_temp.assert_directory_counts('admin_drivers_complete_counts',
  count(*)=3 AND sum(total_trips)=1508
  AND count(*) FILTER(WHERE entity_id='941c0000-0000-4000-8000-000000000200' AND total_trips=1505)=1)
FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100','drivers');
SELECT pg_temp.assert_directory_counts('zero_trip_entities_omitted',
  NOT EXISTS (SELECT 1 FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100','patients') WHERE entity_id='941c0000-0000-4000-8000-000000000302')
  AND NOT EXISTS (SELECT 1 FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100','drivers') WHERE entity_id='941c0000-0000-4000-8000-000000000202'));
SELECT pg_temp.assert_directory_legacy('admin_legacy_equality','941c0000-0000-4000-8000-000000000100');
SELECT pg_temp.assert_directory_empty('cross_org_hidden','941c0000-0000-4000-8000-000000000101');
SELECT pg_temp.assert_directory_empty('unknown_org_empty','941c0000-0000-4000-8000-000000000199');
SELECT pg_temp.expect_directory_error('null_organization',
  $$SELECT * FROM public.directory_trip_counts(NULL,'patients')$$,'22023');
SELECT pg_temp.expect_directory_error('invalid_directory',
  $$SELECT * FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100','employees')$$,'22023');
SELECT pg_temp.expect_directory_error('null_directory',
  $$SELECT * FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100',NULL)$$,'22023');
SELECT pg_temp.expect_directory_error('empty_directory',
  $$SELECT * FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100','')$$,'22023');
SELECT pg_temp.expect_directory_error('case_sensitive_directory',
  $$SELECT * FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100','Patients')$$,'22023');
RESET ROLE;

SELECT set_config('request.jwt.claims','{"sub":"941c0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_directory_counts('driver_only_assigned_trip_counts',
  count(*)=1 AND sum(total_trips)=1506)
FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100','drivers');
SELECT pg_temp.assert_directory_legacy('driver_legacy_equality','941c0000-0000-4000-8000-000000000100');
SELECT pg_temp.assert_directory_empty('driver_cannot_read_foreign_directory','941c0000-0000-4000-8000-000000000101');
RESET ROLE;

SELECT set_config('request.jwt.claims','{"sub":"941c0000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_directory_counts('patient_only_own_trip_counts',
  count(*)=1 AND sum(total_trips)=1506)
FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100','patients');
SELECT pg_temp.assert_directory_legacy('patient_legacy_equality','941c0000-0000-4000-8000-000000000100');
SELECT pg_temp.assert_directory_empty('patient_cannot_read_foreign_directory','941c0000-0000-4000-8000-000000000101');
RESET ROLE;

SELECT set_config('request.jwt.claims','{"sub":"941c0000-0000-4000-8000-000000000004","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_directory_empty('employee_trip_rls_preserved','941c0000-0000-4000-8000-000000000100');
SELECT pg_temp.assert_directory_legacy('employee_legacy_equality','941c0000-0000-4000-8000-000000000100');
RESET ROLE;

SELECT set_config('request.jwt.claims','{"sub":"941c0000-0000-4000-8000-000000000005","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_directory_empty('foreign_admin_denied_a','941c0000-0000-4000-8000-000000000100');
SELECT pg_temp.assert_directory_counts('foreign_admin_own_parent_only',count(*)=1 AND sum(total_trips)=1)
FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000101','patients');
SELECT pg_temp.assert_directory_legacy('foreign_admin_legacy_equality','941c0000-0000-4000-8000-000000000101');
RESET ROLE;

-- Suspension must remove access even though the old memberships remain.
SELECT set_config('request.jwt.claims','{"sub":"941c0000-0000-4000-8000-000000000006","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_directory_empty('disabled_admin_denied','941c0000-0000-4000-8000-000000000100');
SELECT pg_temp.assert_directory_legacy('disabled_admin_legacy_equality','941c0000-0000-4000-8000-000000000100');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"941c0000-0000-4000-8000-000000000007","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_directory_empty('disabled_driver_denied','941c0000-0000-4000-8000-000000000100');
SELECT pg_temp.assert_directory_legacy('disabled_driver_legacy_equality','941c0000-0000-4000-8000-000000000100');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"941c0000-0000-4000-8000-000000000008","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_directory_empty('disabled_patient_denied','941c0000-0000-4000-8000-000000000100');
SELECT pg_temp.assert_directory_legacy('disabled_patient_legacy_equality','941c0000-0000-4000-8000-000000000100');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"941c0000-0000-4000-8000-000000000009","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_directory_empty('nonmember_denied','941c0000-0000-4000-8000-000000000100');
RESET ROLE;

SELECT set_config('request.jwt.claims','{"sub":"941c0000-0000-4000-8000-000000000010","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_directory_counts('parent_org_matches_original_relationship',
  count(*)=3 AND sum(total_trips)=1509)
FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100','patients');
SELECT pg_temp.assert_directory_legacy('multi_org_legacy_equality','941c0000-0000-4000-8000-000000000100');
RESET ROLE;

SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_directory_empty('missing_user_claim_denied','941c0000-0000-4000-8000-000000000100');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SET LOCAL ROLE anon;
SELECT pg_temp.expect_directory_error('anonymous_execute_denied',
  $$SELECT * FROM public.directory_trip_counts('941c0000-0000-4000-8000-000000000100','patients')$$,'42501');
RESET ROLE;

SELECT count(*) AS checks,count(*) FILTER(WHERE passed) AS passed FROM directory_count_results;
ROLLBACK;
