-- Fixture-only live PostgreSQL verification. Every fixture and transition rolls
-- back. Replica mode suppresses assignment notification side effects; RLS and
-- the RPC's own authorization/validation remain active under authenticated.
BEGIN;
SET LOCAL statement_timeout = '45s';
SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users(id,email)
SELECT ('916c0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'web-completion-fixture-'||n||'@example.invalid' FROM generate_series(1,5) n;
INSERT INTO public.user_profiles(user_id,full_name)
SELECT ('916c0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'Completion fixture '||n FROM generate_series(1,5) n;
INSERT INTO public.organizations(id,name) VALUES
 ('916c0000-0000-4000-8000-000000000100','Completion fixture A'),
 ('916c0000-0000-4000-8000-000000000101','Completion fixture B');
INSERT INTO public.organization_memberships(org_id,user_id,role)
SELECT '916c0000-0000-4000-8000-000000000100',
 ('916c0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,r::public.membership_role
 FROM (VALUES(1,'owner'),(2,'admin'),(3,'dispatch'),(4,'driver')) v(n,r);
INSERT INTO public.organization_memberships(org_id,user_id,role) VALUES
 ('916c0000-0000-4000-8000-000000000101','916c0000-0000-4000-8000-000000000005','admin');
INSERT INTO public.drivers(id,org_id,user_id,full_name,active) VALUES
 ('916c0000-0000-4000-8000-000000000200','916c0000-0000-4000-8000-000000000100',
 '916c0000-0000-4000-8000-000000000004','Completion fixture driver',true);
CREATE TEMP TABLE completion_cases AS SELECT
 gen_random_uuid() AS trip_id,gen_random_uuid() AS event_id,
 ('916c0000-0000-4000-8000-'||lpad(actor::text,12,'0'))::uuid AS actor_id,
 status,declined FROM generate_series(1,3) actor
 CROSS JOIN (VALUES('loaded'),('in_progress'),('in_dropoff_circle'),('waiting')) s(status)
 CROSS JOIN (VALUES(true),(false)) d(declined);
INSERT INTO public.trips(id,org_id,driver_id,status,waiting_start_time,total_waiting_minutes)
SELECT trip_id,'916c0000-0000-4000-8000-000000000100','916c0000-0000-4000-8000-000000000200',
 status,now()-interval '5 minutes',2 FROM completion_cases;
INSERT INTO public.trips(id,org_id,driver_id,status) VALUES
 ('916c0000-0000-4000-8000-000000000300','916c0000-0000-4000-8000-000000000100','916c0000-0000-4000-8000-000000000200','loaded');
CREATE TEMP TABLE completion_results(test text,passed boolean);
GRANT ALL ON completion_cases,completion_results TO authenticated;
CREATE FUNCTION pg_temp.complete_fixture(t uuid,e uuid,s text,declined boolean DEFAULT true,gps boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER AS $$
 SELECT public.apply_trip_transition(
 '916c0000-0000-4000-8000-000000000100'::uuid,t,s,'completed',e,'manual',
 CASE WHEN gps THEN 'trip_detail' ELSE 'web_crm' END,CASE WHEN gps THEN 'ios' ELSE 'web' END,
 CASE WHEN gps THEN 44.98::double precision END,CASE WHEN gps THEN -93.27::double precision END,
 CASE WHEN gps THEN 'bg_live' END,CASE WHEN gps THEN clock_timestamp() END,
 CASE WHEN gps THEN 8::double precision END,
 CASE WHEN NOT declined THEN 'data:image/png;base64,dGVzdA==' END,
 CASE WHEN NOT declined THEN 'Fixture rider' END,declined,
 CASE WHEN declined THEN 'Fixture rider declined' END,NULL,NULL)
$$;
DO $$ DECLARE c record; first_result jsonb; replay jsonb; verified boolean; BEGIN
 FOR c IN SELECT * FROM completion_cases LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.actor_id,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  first_result:=pg_temp.complete_fixture(c.trip_id,c.event_id,c.status,c.declined);
  replay:=pg_temp.complete_fixture(c.trip_id,c.event_id,c.status,c.declined);
  SELECT count(*)=1 AND bool_and(h.actor_id=c.actor_id AND h.actor_name LIKE 'Completion fixture %'
    AND h.status_code='completed' AND h.trigger_kind='manual' AND h.source_surface='web_crm'
    AND h.client_platform='web' AND h.latitude IS NULL AND h.longitude IS NULL
    AND h.location_source IS NULL AND h.location_captured_at IS NULL AND h.location_accuracy_m IS NULL)
  INTO verified FROM public.trip_status_history h WHERE h.trip_id=c.trip_id;
  INSERT INTO completion_results VALUES ('manager_matrix',verified
    AND (first_result->>'replayed')::boolean=false AND (replay->>'replayed')::boolean=true
    AND first_result->>'history_id'=replay->>'history_id'
    AND EXISTS(SELECT 1 FROM public.trips WHERE id=c.trip_id AND status='completed'
      AND signature_declined=c.declined AND signature_captured_at IS NOT NULL
      AND CASE WHEN c.declined THEN signature_declined_reason='Fixture rider declined'
        AND signature_data IS NULL AND signed_by_name IS NULL
        ELSE signature_data='data:image/png;base64,dGVzdA==' AND signed_by_name='Fixture rider'
          AND signature_declined_reason IS NULL END));
  RESET ROLE;
 END LOOP;
END $$;
CREATE FUNCTION pg_temp.expect_denial(expected_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE actual_code text;
BEGIN
 BEGIN
  PERFORM pg_temp.complete_fixture('916c0000-0000-4000-8000-000000000300',gen_random_uuid(),'loaded');
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE;
  IF actual_code=expected_code THEN RETURN true; END IF;
  RAISE EXCEPTION 'Unexpected denial code: %',actual_code;
 END;
 RAISE EXCEPTION 'Unauthorized completion was accepted';
END $$;
SELECT set_config('request.jwt.claims','{"sub":"916c0000-0000-4000-8000-000000000004","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO completion_results VALUES('driver_missing_gps_denied',pg_temp.expect_denial('23514'));
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"916c0000-0000-4000-8000-000000000005","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO completion_results VALUES('cross_org_manager_denied',pg_temp.expect_denial('P0002'));
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"916c0000-0000-4000-8000-000000000004","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.complete_fixture('916c0000-0000-4000-8000-000000000300',gen_random_uuid(),'loaded',false,true) IS NOT NULL AS driver_completion_verified;
INSERT INTO completion_results SELECT 'driver_gps_preserved',count(*)=1 AND bool_and(latitude=44.98 AND longitude=-93.27
 AND location_source='bg_live' AND location_accuracy_m=8) FROM public.trip_status_history
 WHERE trip_id='916c0000-0000-4000-8000-000000000300';
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"916c0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.trip_status_history(trip_id,status,actor_id,actor_name,status_code,trigger_kind,source_surface,client_platform,client_event_id)
  VALUES('916c0000-0000-4000-8000-000000000300','COMPLETED (Signature Declined)',auth.uid(),'Forged fixture actor','completed','manual','web_crm','web',gen_random_uuid());
  RAISE EXCEPTION 'Direct administrative completion evidence unexpectedly accepted';
 EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO completion_results VALUES('direct_administrative_evidence_denied',true);
 END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM completion_results WHERE passed IS DISTINCT FROM true) THEN
  RAISE EXCEPTION 'Web completion live regression';
 END IF;
END $$;
SELECT count(*) AS checks,count(*) FILTER(WHERE passed) AS passed,'all fixture writes rolled back' AS scope FROM completion_results;
ROLLBACK;
