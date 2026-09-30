-- Isolated fixture regression for the office workflow. All writes roll back.
-- Replica mode suppresses assignment notifications; ALWAYS evidence guards,
-- RLS, authenticated role permissions, and RPC validation remain active.
BEGIN;
SET LOCAL statement_timeout = '60s';
SET LOCAL session_replication_role = 'replica';
INSERT INTO auth.users(id,email)
SELECT ('930f0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'web-flow-fixture-'||n||'@example.invalid' FROM generate_series(1,7) n;
INSERT INTO public.user_profiles(user_id,full_name)
SELECT ('930f0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'Flow fixture '||n FROM generate_series(1,7) n;
INSERT INTO public.organizations(id,name) VALUES
 ('930f0000-0000-4000-8000-000000000100','Flow fixture A'),
 ('930f0000-0000-4000-8000-000000000101','Flow fixture B');
INSERT INTO public.organization_memberships(org_id,user_id,role)
SELECT '930f0000-0000-4000-8000-000000000100',
 ('930f0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,r::public.membership_role
 FROM (VALUES(1,'owner'),(2,'admin'),(3,'dispatch'),(4,'driver'),(5,'employee'),(7,'driver')) v(n,r);
INSERT INTO public.organization_memberships(org_id,user_id,role) VALUES
 ('930f0000-0000-4000-8000-000000000101','930f0000-0000-4000-8000-000000000006','admin');
INSERT INTO public.drivers(id,org_id,user_id,full_name,active) VALUES
 ('930f0000-0000-4000-8000-000000000200','930f0000-0000-4000-8000-000000000100',
  '930f0000-0000-4000-8000-000000000004','Flow fixture driver',true),
 ('930f0000-0000-4000-8000-000000000201','930f0000-0000-4000-8000-000000000100',
  '930f0000-0000-4000-8000-000000000007','Flow fixture other driver',true);
CREATE TEMP TABLE flow_cases AS SELECT
 gen_random_uuid() AS trip_id,
 ('930f0000-0000-4000-8000-'||lpad(actor::text,12,'0'))::uuid AS actor_id,
 status,signed FROM generate_series(1,3) actor
 CROSS JOIN (VALUES('assigned'),('accepted')) s(status)
 CROSS JOIN (VALUES(true),(false)) d(signed);
INSERT INTO public.trips(id,org_id,driver_id,status)
SELECT trip_id,'930f0000-0000-4000-8000-000000000100','930f0000-0000-4000-8000-000000000200',status FROM flow_cases;
INSERT INTO public.trips(id,org_id,driver_id,status)
SELECT ('930f0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '930f0000-0000-4000-8000-000000000100','930f0000-0000-4000-8000-000000000200',s
FROM (VALUES(300,'assigned'),(301,'loaded'),(302,'arrived'),(303,'en_route'),
 (304,'assigned'),(305,'assigned'),(306,'loaded'),(307,'in_progress'),
 (308,'in_dropoff_circle'),(309,'waiting'),(310,'in_pickup_circle')) fixtures(n,s);
CREATE TEMP TABLE flow_results(test text,passed boolean);
GRANT ALL ON flow_cases,flow_results TO authenticated;

CREATE FUNCTION pg_temp.flow_transition(
 t uuid,old_status text,new_status text,e uuid DEFAULT gen_random_uuid(),
 signed boolean DEFAULT NULL,gps boolean DEFAULT false,
 surface text DEFAULT 'web_crm',platform text DEFAULT 'web',kind text DEFAULT 'manual',
 cancel_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER AS $$
 SELECT public.apply_trip_transition(
 '930f0000-0000-4000-8000-000000000100'::uuid,t,old_status,new_status,e,kind,surface,platform,
 CASE WHEN gps THEN 44.98::double precision END,CASE WHEN gps THEN -93.27::double precision END,
 CASE WHEN gps THEN 'bg_live' END,CASE WHEN gps THEN clock_timestamp() END,
 CASE WHEN gps THEN 8::double precision END,
 CASE WHEN new_status='completed' AND signed THEN 'data:image/png;base64,dGVzdA==' END,
 CASE WHEN new_status='completed' AND signed THEN 'Fixture rider' END,
 CASE WHEN new_status='completed' THEN NOT signed END,
 CASE WHEN new_status='completed' AND NOT signed THEN 'Fixture rider unable to sign' END,
 cancel_reason,NULL)
$$;
CREATE FUNCTION pg_temp.expect_flow_denial(statement text,expected_codes text[])
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE actual_code text;
BEGIN
 BEGIN
  EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS actual_code=RETURNED_SQLSTATE;
  IF actual_code=ANY(expected_codes) THEN RETURN true; END IF;
  RAISE EXCEPTION 'Unexpected denial code %, expected %',actual_code,expected_codes;
 END;
 RAISE EXCEPTION 'Expected rejection but statement succeeded: %',statement;
END $$;

DO $$ DECLARE c record; next_status text; prior_status text; eid uuid;
 first_result jsonb; replay jsonb; verified boolean;
BEGIN
 FOR c IN SELECT * FROM flow_cases LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.actor_id,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  prior_status:=c.status;
  FOREACH next_status IN ARRAY ARRAY['en_route','arrived','loaded','completed'] LOOP
   eid:=gen_random_uuid();
   first_result:=pg_temp.flow_transition(c.trip_id,prior_status,next_status,eid,c.signed);
   replay:=pg_temp.flow_transition(c.trip_id,prior_status,next_status,eid,c.signed);
   SELECT count(*)=1 AND bool_and(h.actor_id=c.actor_id AND h.actor_name LIKE 'Flow fixture %'
    AND h.status_code=next_status AND h.trigger_kind='manual' AND h.source_surface='web_crm'
    AND h.client_platform='web' AND h.latitude IS NULL AND h.longitude IS NULL
    AND h.location_source IS NULL AND h.location_captured_at IS NULL AND h.location_accuracy_m IS NULL)
   INTO verified FROM public.trip_status_history h WHERE h.trip_id=c.trip_id AND h.client_event_id=eid;
   INSERT INTO flow_results VALUES ('manager_'||next_status,verified
    AND (first_result->>'replayed')::boolean=false AND (replay->>'replayed')::boolean=true
    AND first_result->>'history_id'=replay->>'history_id');
   prior_status:=next_status;
  END LOOP;
  INSERT INTO flow_results SELECT 'atomic_signature',count(*)=1 AND bool_and(status='completed'
    AND signature_declined=NOT c.signed AND signature_captured_at IS NOT NULL
    AND CASE WHEN c.signed THEN signature_data='data:image/png;base64,dGVzdA=='
      AND signed_by_name='Fixture rider' AND signature_declined_reason IS NULL
     ELSE signature_declined_reason='Fixture rider unable to sign'
      AND signature_data IS NULL AND signed_by_name IS NULL END)
   FROM public.trips WHERE id=c.trip_id;
  INSERT INTO flow_results VALUES('completion_replay_payload_mismatch',pg_temp.expect_flow_denial(
   format('SELECT pg_temp.flow_transition(%L,%L,%L,%L,%L)',c.trip_id,'loaded','completed',eid,NOT c.signed),ARRAY['23505']));
  RESET ROLE;
 END LOOP;
END $$;

-- Same-organization employees and unrelated drivers must never gain office access.
DO $$ DECLARE actor integer; next_status text; tid text; old_status text;
BEGIN
 FOREACH actor IN ARRAY ARRAY[5,6,7] LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',
    ('930f0000-0000-4000-8000-'||lpad(actor::text,12,'0')),'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  FOR tid,old_status,next_status IN SELECT * FROM (VALUES
    ('930f0000-0000-4000-8000-000000000300','assigned','en_route'),
    ('930f0000-0000-4000-8000-000000000303','en_route','arrived'),
    ('930f0000-0000-4000-8000-000000000302','arrived','loaded'),
    ('930f0000-0000-4000-8000-000000000301','loaded','completed')) c LOOP
   INSERT INTO flow_results VALUES('unauthorized_role_'||actor||'_'||next_status,pg_temp.expect_flow_denial(
    format('SELECT pg_temp.flow_transition(%L,%L,%L,signed=>true)',tid,old_status,next_status),ARRAY['42501','P0002']));
  END LOOP;
  RESET ROLE;
 END LOOP;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"930f0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO flow_results VALUES
 ('stale_status_conflict',pg_temp.expect_flow_denial(
  $s$SELECT pg_temp.flow_transition('930f0000-0000-4000-8000-000000000300','accepted','en_route')$s$,ARRAY['PT409','40001'])),
 ('signature_required',pg_temp.expect_flow_denial(
  $s$SELECT pg_temp.flow_transition('930f0000-0000-4000-8000-000000000301','loaded','completed')$s$,ARRAY['22004'])),
 ('office_mobile_provenance_denied',pg_temp.expect_flow_denial(
  $s$SELECT pg_temp.flow_transition('930f0000-0000-4000-8000-000000000300','assigned','en_route',platform=>'ios',surface=>'trip_detail')$s$,ARRAY['42501'])),
 ('office_automatic_provenance_denied',pg_temp.expect_flow_denial(
  $s$SELECT pg_temp.flow_transition('930f0000-0000-4000-8000-000000000300','assigned','en_route',kind=>'automatic')$s$,ARRAY['42501'])),
 ('skipped_start_denied',pg_temp.expect_flow_denial(
  $s$SELECT pg_temp.flow_transition('930f0000-0000-4000-8000-000000000300','assigned','loaded')$s$,ARRAY['23514']));
DO $$ DECLARE s text; BEGIN
 FOREACH s IN ARRAY ARRAY['en_route','loaded','completed'] LOOP
  INSERT INTO flow_results VALUES('direct_history_'||s||'_denied',pg_temp.expect_flow_denial(format(
   'INSERT INTO public.trip_status_history(trip_id,status,actor_id,actor_name,status_code,trigger_kind,source_surface,client_platform,client_event_id) VALUES(%L,%L,auth.uid(),%L,%L,%L,%L,%L,gen_random_uuid())',
   '930f0000-0000-4000-8000-000000000300',upper(s),'Forged fixture',s,'manual','web_crm','web'),ARRAY['42501']));
 END LOOP;
END $$;
-- Supported mobile states remain completable from the office.
DO $$ DECLARE n integer; s text; BEGIN
 FOR n,s IN SELECT * FROM (VALUES(307,'in_progress'),(308,'in_dropoff_circle'),(309,'waiting')) aliases LOOP
  INSERT INTO flow_results VALUES('complete_alias_'||s,pg_temp.flow_transition(
   ('930f0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,s,'completed',signed=>true) IS NOT NULL);
 END LOOP;
 INSERT INTO flow_results VALUES('pickup_circle_to_loaded',pg_temp.flow_transition(
  '930f0000-0000-4000-8000-000000000310','in_pickup_circle','loaded') IS NOT NULL);
END $$;
-- Preserve the existing cancellation/no-show reason requirements and audit.
INSERT INTO flow_results VALUES
 ('cancel_reason_required',pg_temp.expect_flow_denial(
  $s$SELECT pg_temp.flow_transition('930f0000-0000-4000-8000-000000000304','assigned','cancelled')$s$,ARRAY['22023'])),
 ('no_show_reason_required',pg_temp.expect_flow_denial(
  $s$SELECT pg_temp.flow_transition('930f0000-0000-4000-8000-000000000305','assigned','no_show')$s$,ARRAY['22023'])),
 ('cancel_preserved',pg_temp.flow_transition('930f0000-0000-4000-8000-000000000304','assigned','cancelled',cancel_reason=>'appointment cancel') IS NOT NULL),
 ('no_show_preserved',pg_temp.flow_transition('930f0000-0000-4000-8000-000000000305','assigned','no_show',cancel_reason=>'patient_no_show') IS NOT NULL);
INSERT INTO flow_results SELECT 'cancellation_audits_preserved',count(*)=2
 FROM public.trip_cancellation_audits WHERE trip_id IN
 ('930f0000-0000-4000-8000-000000000304','930f0000-0000-4000-8000-000000000305');
RESET ROLE;

-- Assigned drivers still need GPS at major milestones. Their mobile provenance
-- and location survive alongside the new office exception.
SELECT set_config('request.jwt.claims','{"sub":"930f0000-0000-4000-8000-000000000004","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO flow_results VALUES
 ('driver_start_gps_required',pg_temp.expect_flow_denial(
  $s$SELECT pg_temp.flow_transition('930f0000-0000-4000-8000-000000000300','assigned','en_route')$s$,ARRAY['23514'])),
 ('driver_pickup_gps_required',pg_temp.expect_flow_denial(
  $s$SELECT pg_temp.flow_transition('930f0000-0000-4000-8000-000000000302','arrived','loaded')$s$,ARRAY['23514'])),
 ('driver_completion_gps_required',pg_temp.expect_flow_denial(
  $s$SELECT pg_temp.flow_transition('930f0000-0000-4000-8000-000000000301','loaded','completed',signed=>true)$s$,ARRAY['23514'])),
 ('driver_start_with_gps',pg_temp.flow_transition('930f0000-0000-4000-8000-000000000300','assigned','en_route',gps=>true,surface=>'trip_detail',platform=>'ios') IS NOT NULL),
 ('driver_pickup_with_gps',pg_temp.flow_transition('930f0000-0000-4000-8000-000000000302','arrived','loaded',gps=>true,surface=>'trip_detail',platform=>'ios') IS NOT NULL),
 ('driver_completion_with_gps',pg_temp.flow_transition('930f0000-0000-4000-8000-000000000301','loaded','completed',signed=>true,gps=>true,surface=>'trip_detail',platform=>'ios') IS NOT NULL);
INSERT INTO flow_results SELECT 'driver_evidence_preserved',count(*)=3 AND bool_and(latitude=44.98 AND longitude=-93.27
 AND location_source='bg_live' AND location_accuracy_m=8 AND source_surface='trip_detail' AND client_platform='ios')
 FROM public.trip_status_history WHERE trip_id IN
 ('930f0000-0000-4000-8000-000000000300','930f0000-0000-4000-8000-000000000302','930f0000-0000-4000-8000-000000000301');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO flow_results VALUES('missing_auth_denied',pg_temp.expect_flow_denial(
 $s$SELECT pg_temp.flow_transition('930f0000-0000-4000-8000-000000000306','loaded','completed',signed=>true)$s$,ARRAY['28000']));
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM flow_results WHERE passed IS DISTINCT FROM true) THEN
  RAISE EXCEPTION 'Web flow regression: %',(SELECT string_agg(test,', ') FROM flow_results WHERE passed IS DISTINCT FROM true);
 END IF;
END $$;
SELECT count(*) AS checks,count(*) FILTER(WHERE passed) AS passed,'all fixture writes rolled back' AS scope FROM flow_results;
ROLLBACK;
