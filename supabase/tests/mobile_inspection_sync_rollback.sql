-- Authenticated fixture-only regression proof; all records and schema trials
-- roll back. No historical driver dates are converted into submissions.
BEGIN;
SET LOCAL statement_timeout='45s';
SET LOCAL session_replication_role='replica';
INSERT INTO auth.users(id,email) SELECT ('916e0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'mobile-sts-fixture-'||n||'@example.invalid' FROM generate_series(1,5) n;
INSERT INTO public.user_profiles(user_id,full_name) SELECT ('916e0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'Mobile STS fixture '||n FROM generate_series(1,5) n;
INSERT INTO public.organizations(id,name) VALUES
 ('916e0000-0000-4000-8000-000000000100','Mobile STS fixture A'),('916e0000-0000-4000-8000-000000000101','Mobile STS fixture B');
INSERT INTO public.organization_memberships(org_id,user_id,role)
SELECT ('916e0000-0000-4000-8000-'||lpad(org::text,12,'0'))::uuid,
 ('916e0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,r::public.membership_role
 FROM (VALUES(1,100,'driver'),(2,101,'driver'),(3,100,'admin'),(4,100,'dispatch'),(5,101,'admin')) v(n,org,r);
INSERT INTO public.drivers(id,org_id,user_id,full_name,active) VALUES
 ('916e0000-0000-4000-8000-000000000200','916e0000-0000-4000-8000-000000000100','916e0000-0000-4000-8000-000000000001','Mobile STS driver A',true),
 ('916e0000-0000-4000-8000-000000000201','916e0000-0000-4000-8000-000000000101','916e0000-0000-4000-8000-000000000002','Mobile STS driver B',true);
SET LOCAL session_replication_role='origin';
CREATE TEMP TABLE mobile_sts_results(test text,passed boolean);
CREATE TEMP TABLE mobile_sts_state(payload jsonb,report_id uuid,initial_version timestamptz,current_version timestamptz);
GRANT ALL ON mobile_sts_results,mobile_sts_state TO authenticated;
INSERT INTO mobile_sts_state(payload)
SELECT jsonb_build_object('id','916e0000-0000-4000-8000-000000000200_2026-09-15',
 'driverId','916e0000-0000-4000-8000-000000000200','date','2026-09-15','dayOfWeek','Tuesday',
 'submittedAt','2026-09-15T15:00:00.000Z','driverInfo',jsonb_build_object('driverName','Driver name snapshot',
 'mndotNumber','12345','make','Ford','model','Transit','year','2024','licensePlate','QA-ONLY','mileage','12000'),
 'items',jsonb_agg(jsonb_build_object('key',key,'label',key,'status',CASE WHEN key='tires' THEN 'no_good' ELSE 'good' END,
 'explanation',CASE WHEN key='tires' THEN 'Synthetic tire issue' ELSE '' END) ORDER BY ordinal))
FROM unnest(ARRAY['vehicle_brakes','parking_brake','steering_mechanism','lighting_devices','tires','horn','wipers','mirrors',
 'emergency_equipment','wheelchair_ramps','wheelchair_securement','remarks']) WITH ORDINALITY defs(key,ordinal);
CREATE FUNCTION pg_temp.expect_error(statement text,expected text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER AS $$ DECLARE actual text; BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE;
  IF actual=expected THEN RETURN true; END IF; RAISE EXCEPTION 'Expected %, received %',expected,actual;
 END;
 RAISE EXCEPTION 'Invalid inspection operation was accepted';
END $$;
SELECT set_config('request.jwt.claims','{"sub":"916e0000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.driver_sts_inspections(id,org_id,driver_id,title,inspection_date,inspector_name,result)
 VALUES('916e0000-0000-4000-8000-000000000300','916e0000-0000-4000-8000-000000000100',
 '916e0000-0000-4000-8000-000000000200','Staff-only inspection','2026-09-14','Inspector','passed');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"916e0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE first_row public.driver_sts_inspections%ROWTYPE; replay public.driver_sts_inspections%ROWTYPE; body jsonb; BEGIN
 SELECT payload INTO body FROM mobile_sts_state;
 first_row:=public.submit_driver_sts_inspection('916e0000-0000-4000-8000-000000000100',body);
 replay:=public.submit_driver_sts_inspection('916e0000-0000-4000-8000-000000000100',body);
 UPDATE mobile_sts_state SET report_id=first_row.id,initial_version=first_row.updated_at,current_version=first_row.updated_at;
 INSERT INTO mobile_sts_results VALUES
 ('driver_submission',first_row.source='mobile_app' AND first_row.source_record_id=body->>'id' AND first_row.inspection_payload=body),
 ('no_invented_pass',first_row.result='pending'),
 ('driver_attribution',first_row.created_by=auth.uid() AND first_row.updated_by=auth.uid() AND first_row.inspector_name='Driver name snapshot'),
 ('readable_findings',first_row.notes LIKE '%tires: No good%Synthetic tire issue%'),
 ('idempotent_replay',replay.id=first_row.id AND replay.updated_at=first_row.updated_at),
 ('driver_read_own_only',(SELECT count(*)=1 FROM public.driver_sts_inspections));
END $$;
INSERT INTO mobile_sts_results VALUES
 ('direct_driver_update_denied',pg_temp.expect_error('UPDATE public.driver_sts_inspections SET result=''passed''','42501')),
 ('direct_driver_insert_denied',pg_temp.expect_error('INSERT INTO public.driver_sts_inspections(org_id,driver_id,title,inspection_date,inspector_name) VALUES(''916e0000-0000-4000-8000-000000000100'',''916e0000-0000-4000-8000-000000000200'',''Forged'',''2026-09-15'',''Driver'')','42501')),
 ('delete_denied',pg_temp.expect_error('DELETE FROM public.driver_sts_inspections','42501')),
 ('missing_expected_conflict',pg_temp.expect_error('SELECT public.submit_driver_sts_inspection(''916e0000-0000-4000-8000-000000000100'',jsonb_set(payload,''{submittedAt}'',''"2026-09-15T16:00:00.000Z"'')) FROM mobile_sts_state','40001')),
 ('incomplete_checklist',pg_temp.expect_error('SELECT public.submit_driver_sts_inspection(''916e0000-0000-4000-8000-000000000100'',jsonb_set(payload,''{items}'',''[]'')) FROM mobile_sts_state','22023')),
 ('null_remarks_status',pg_temp.expect_error('SELECT public.submit_driver_sts_inspection(''916e0000-0000-4000-8000-000000000100'',jsonb_set(payload,''{items,11,status}'',''null'')) FROM mobile_sts_state','22023')),
 ('missing_issue_explanation',pg_temp.expect_error('SELECT public.submit_driver_sts_inspection(''916e0000-0000-4000-8000-000000000100'',jsonb_set(payload,''{items,4,explanation}'',''""'')) FROM mobile_sts_state','22023')),
 ('identity_mismatch',pg_temp.expect_error('SELECT public.submit_driver_sts_inspection(''916e0000-0000-4000-8000-000000000100'',jsonb_set(payload,''{id}'',''"forged"'')) FROM mobile_sts_state','22023')),
 ('invalid_mileage',pg_temp.expect_error('SELECT public.submit_driver_sts_inspection(''916e0000-0000-4000-8000-000000000100'',jsonb_set(payload,''{driverInfo,mileage}'',''"abc"'')) FROM mobile_sts_state','22023')),
 ('cross_org_submit_denied',pg_temp.expect_error('SELECT public.submit_driver_sts_inspection(''916e0000-0000-4000-8000-000000000101'',payload) FROM mobile_sts_state','42501'));
DO $$ DECLARE edited public.driver_sts_inspections%ROWTYPE; body jsonb; version timestamptz; BEGIN
 SELECT jsonb_set(payload,'{submittedAt}','"2026-09-15T16:00:00.000Z"'),current_version INTO body,version FROM mobile_sts_state;
 edited:=public.submit_driver_sts_inspection('916e0000-0000-4000-8000-000000000100',body,version);
 INSERT INTO mobile_sts_results VALUES('versioned_driver_edit',edited.inspection_payload=body AND edited.updated_at>version);
 UPDATE mobile_sts_state SET payload=body,current_version=edited.updated_at;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"916e0000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name,owner_id,metadata)
 SELECT 'compliance-documents','916e0000-0000-4000-8000-000000000100/sts/'||report_id::text||'/staff-report.pdf',
 auth.uid()::text,'{"mimetype":"application/pdf","size":100}' FROM mobile_sts_state;
UPDATE public.driver_sts_inspections SET report_file_path='916e0000-0000-4000-8000-000000000100/sts/'||id::text||'/staff-report.pdf',
 report_filename='staff-report.pdf',report_file_type='application/pdf',report_file_size=100 WHERE source='mobile_app';
UPDATE public.driver_sts_inspections SET title='Staff-reviewed daily checklist',result='follow_up',notes='Staff follow-up notes',reference='QA-REVIEW',next_due_date='2026-09-30'
 WHERE source='mobile_app';
INSERT INTO mobile_sts_results VALUES
 ('staff_cannot_rewrite_payload',pg_temp.expect_error('UPDATE public.driver_sts_inspections SET inspection_payload=jsonb_set(inspection_payload,''{submittedAt}'',''"2026-09-15T17:00:00.000Z"'') WHERE source=''mobile_app''','42501')),
 ('staff_cannot_relabel_source',pg_temp.expect_error('UPDATE public.driver_sts_inspections SET source=''web_crm'',source_record_id=NULL,inspection_payload=NULL WHERE source=''mobile_app''','42501')),
 ('staff_cannot_change_mobile_date',pg_temp.expect_error('UPDATE public.driver_sts_inspections SET inspection_date=''2026-09-16'' WHERE source=''mobile_app''','42501')),
 ('staff_read_all',(SELECT count(*)=2 FROM public.driver_sts_inspections));
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"916e0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO mobile_sts_results VALUES
 ('stale_version_conflict',pg_temp.expect_error('SELECT public.submit_driver_sts_inspection(''916e0000-0000-4000-8000-000000000100'',jsonb_set(payload,''{submittedAt}'',''"2026-09-15T17:00:00.000Z"''),current_version) FROM mobile_sts_state','40001'));
DO $$ DECLARE current_row public.driver_sts_inspections%ROWTYPE; replay public.driver_sts_inspections%ROWTYPE; edited public.driver_sts_inspections%ROWTYPE; body jsonb; BEGIN
 SELECT * INTO current_row FROM public.driver_sts_inspections WHERE source='mobile_app';
 SELECT payload INTO body FROM mobile_sts_state;
 replay:=public.submit_driver_sts_inspection('916e0000-0000-4000-8000-000000000100',body);
 INSERT INTO mobile_sts_results VALUES('replay_preserves_staff_edits',replay.updated_at=current_row.updated_at AND replay.notes='Staff follow-up notes');
 body:=jsonb_set(body,'{submittedAt}','"2026-09-15T17:00:00.000Z"');
 edited:=public.submit_driver_sts_inspection('916e0000-0000-4000-8000-000000000100',body,current_row.updated_at);
 INSERT INTO mobile_sts_results VALUES('driver_edit_preserves_review',edited.title=current_row.title AND edited.result=current_row.result AND edited.reference=current_row.reference AND edited.notes=current_row.notes AND edited.next_due_date=current_row.next_due_date AND edited.created_by=current_row.created_by AND edited.updated_by=auth.uid() AND edited.report_file_path=current_row.report_file_path AND edited.report_filename=current_row.report_filename);
 INSERT INTO mobile_sts_results VALUES('driver_still_has_no_storage_access',(SELECT count(*)=0 FROM storage.objects WHERE bucket_id='compliance-documents'));
END $$;
RESET ROLE;
DO $$ DECLARE n integer; BEGIN
 FOREACH n IN ARRAY ARRAY[2,4,5] LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',('916e0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO mobile_sts_results VALUES
   ('other_actor_read_denied_'||n,(SELECT count(*)=0 FROM public.driver_sts_inspections)),
   ('other_actor_submit_denied_'||n,pg_temp.expect_error('SELECT public.submit_driver_sts_inspection(''916e0000-0000-4000-8000-000000000100'',payload) FROM mobile_sts_state','42501'));
  RESET ROLE;
 END LOOP;
END $$;
-- Disabled driver access is checked even if the caller still holds a JWT.
UPDATE public.drivers SET active=false WHERE id='916e0000-0000-4000-8000-000000000200';
SELECT set_config('request.jwt.claims','{"sub":"916e0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO mobile_sts_results VALUES('disabled_driver_submit_denied',pg_temp.expect_error('SELECT public.submit_driver_sts_inspection(''916e0000-0000-4000-8000-000000000100'',payload) FROM mobile_sts_state','42501'));
RESET ROLE;
INSERT INTO mobile_sts_results VALUES('rpc_not_definer',NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.submit_driver_sts_inspection(uuid,jsonb,timestamptz)'::regprocedure)),
 ('rpc_anon_denied',NOT has_function_privilege('anon','public.submit_driver_sts_inspection(uuid,jsonb,timestamptz)','EXECUTE'));
DO $$ BEGIN IF EXISTS(SELECT 1 FROM mobile_sts_results WHERE passed IS DISTINCT FROM true) THEN
 RAISE EXCEPTION 'Mobile STS synchronization regression'; END IF; END $$;
SELECT count(*) AS checks,count(*) FILTER(WHERE passed) AS passed,'all fixtures rolled back' AS scope FROM mobile_sts_results;
ROLLBACK;
