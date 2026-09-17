-- Isolated synthetic fixtures; no storage bytes or real application rows.
BEGIN;
SET LOCAL statement_timeout='45s';
SET LOCAL session_replication_role='replica';
INSERT INTO auth.users(id,email) SELECT ('916d0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'compliance-fixture-'||n||'@example.invalid' FROM generate_series(1,5) n;
INSERT INTO public.user_profiles(user_id,full_name) SELECT ('916d0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'Compliance fixture '||n FROM generate_series(1,5) n;
INSERT INTO public.organizations(id,name) VALUES
 ('916d0000-0000-4000-8000-000000000100','Compliance fixture A'),('916d0000-0000-4000-8000-000000000101','Compliance fixture B');
INSERT INTO public.organization_memberships(org_id,user_id,role)
SELECT '916d0000-0000-4000-8000-000000000100',('916d0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,r::public.membership_role
 FROM (VALUES(1,'owner'),(2,'admin'),(3,'dispatch'),(4,'driver')) v(n,r);
INSERT INTO public.organization_memberships(org_id,user_id,role) VALUES
 ('916d0000-0000-4000-8000-000000000101','916d0000-0000-4000-8000-000000000005','owner');
INSERT INTO public.drivers(id,org_id,full_name,active) VALUES
 ('916d0000-0000-4000-8000-000000000200','916d0000-0000-4000-8000-000000000100','Compliance driver A',true),
 ('916d0000-0000-4000-8000-000000000201','916d0000-0000-4000-8000-000000000101','Compliance driver B',true);
SET LOCAL session_replication_role='origin';
CREATE TEMP TABLE compliance_results(test text,passed boolean);
GRANT ALL ON compliance_results TO authenticated;
CREATE FUNCTION pg_temp.expect_rejection(statement text,expected text DEFAULT '42501') RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER AS $$ DECLARE actual text; BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE;
  IF actual=expected THEN RETURN true; END IF; RAISE EXCEPTION 'Expected %, received %',expected,actual;
 END;
 RAISE EXCEPTION 'Unauthorized/invalid statement unexpectedly succeeded';
END $$;
SELECT set_config('request.jwt.claims','{"sub":"916d0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('compliance-documents',
 '916d0000-0000-4000-8000-000000000100/company/916d0000-0000-4000-8000-000000000300/fixture.pdf',
 '916d0000-0000-4000-8000-000000000001','{"mimetype":"application/pdf","size":100}');
INSERT INTO public.company_documents(id,org_id,title,label,file_path,original_filename,file_type,file_size)
 VALUES('916d0000-0000-4000-8000-000000000300','916d0000-0000-4000-8000-000000000100','Fixture company report','Annual audit',
 '916d0000-0000-4000-8000-000000000100/company/916d0000-0000-4000-8000-000000000300/fixture.pdf','fixture.pdf','application/pdf',100);
INSERT INTO public.driver_sts_inspections(id,org_id,driver_id,title,inspection_date,inspector_name,result)
 VALUES('916d0000-0000-4000-8000-000000000400','916d0000-0000-4000-8000-000000000100',
 '916d0000-0000-4000-8000-000000000200','Fixture inspection','2026-09-16','Fixture inspector','passed');
INSERT INTO compliance_results SELECT 'owner_read_and_server_attribution',uploaded_by=auth.uid()
 AND uploaded_by_name='Compliance fixture 1' AND updated_by=auth.uid() FROM public.company_documents
 WHERE id='916d0000-0000-4000-8000-000000000300';
INSERT INTO compliance_results VALUES
 ('forged_size',pg_temp.expect_rejection('UPDATE public.company_documents SET file_size=99')),
 ('forged_uploader',pg_temp.expect_rejection('UPDATE public.company_documents SET uploaded_by=''916d0000-0000-4000-8000-000000000002''')),
 ('forged_uploader_name',pg_temp.expect_rejection('UPDATE public.company_documents SET uploaded_by_name=''Fake''')),
 ('forged_updated_at',pg_temp.expect_rejection('UPDATE public.company_documents SET updated_at=now()+interval ''1 day''')),
 ('change_org',pg_temp.expect_rejection('UPDATE public.company_documents SET org_id=''916d0000-0000-4000-8000-000000000101''')),
 ('invalid_expiry',pg_temp.expect_rejection('UPDATE public.driver_sts_inspections SET next_due_date=''2020-01-01''','23514')),
 ('change_driver',pg_temp.expect_rejection('UPDATE public.driver_sts_inspections SET driver_id=''916d0000-0000-4000-8000-000000000201''')),
 ('delete_company_denied',pg_temp.expect_rejection('DELETE FROM public.company_documents')),
 ('delete_inspection_denied',pg_temp.expect_rejection('DELETE FROM public.driver_sts_inspections')),
 ('cross_org_driver_fk',pg_temp.expect_rejection('INSERT INTO public.driver_sts_inspections(org_id,driver_id,title,inspection_date,inspector_name) VALUES(''916d0000-0000-4000-8000-000000000100'',''916d0000-0000-4000-8000-000000000201'',''Bad'',''2026-09-16'',''Tester'')','23503')),
 ('fake_metadata_without_object',pg_temp.expect_rejection('INSERT INTO public.company_documents(org_id,title,label,file_path,original_filename,file_type,file_size) VALUES(''916d0000-0000-4000-8000-000000000100'',''Fake'',''Audit'',''nonexistent.pdf'',''fake.pdf'',''application/pdf'',100)','23514')),
 ('malformed_storage_path',pg_temp.expect_rejection('INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES(''compliance-documents'',''916d0000-0000-4000-8000-000000000100/bad/file.pdf'',auth.uid()::text,''{}'')'));
INSERT INTO compliance_results VALUES('direct_storage_delete_denied',pg_temp.expect_rejection('DELETE FROM storage.objects WHERE bucket_id=''compliance-documents'''));
WITH edited AS(UPDATE storage.objects SET metadata='{}' WHERE bucket_id='compliance-documents' RETURNING id)
 INSERT INTO compliance_results SELECT 'storage_overwrite_denied',count(*)=0 FROM edited;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"916d0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
UPDATE public.company_documents SET title='Admin corrected title' WHERE id='916d0000-0000-4000-8000-000000000300';
UPDATE public.driver_sts_inspections SET result='follow_up',notes='Admin correction' WHERE id='916d0000-0000-4000-8000-000000000400';
INSERT INTO compliance_results SELECT 'admin_edit_preserves_original_actor',title='Admin corrected title'
 AND updated_by=auth.uid() AND uploaded_by='916d0000-0000-4000-8000-000000000001'
 AND uploaded_by_name='Compliance fixture 1' FROM public.company_documents;
INSERT INTO compliance_results SELECT 'admin_edit_inspection',result='follow_up' AND updated_by=auth.uid()
 AND created_by='916d0000-0000-4000-8000-000000000001' FROM public.driver_sts_inspections;
RESET ROLE;
DO $$ DECLARE n integer; BEGIN
 FOREACH n IN ARRAY ARRAY[3,4,5] LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',('916d0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO compliance_results SELECT 'nonmanager_company_read_'||n,count(*)=0 FROM public.company_documents;
  INSERT INTO compliance_results SELECT 'nonmanager_inspection_read_'||n,count(*)=0 FROM public.driver_sts_inspections;
  INSERT INTO compliance_results SELECT 'nonmanager_storage_read_'||n,count(*)=0 FROM storage.objects WHERE bucket_id='compliance-documents';
  INSERT INTO compliance_results VALUES
   ('nonmanager_insert_'||n,pg_temp.expect_rejection('INSERT INTO public.driver_sts_inspections(org_id,driver_id,title,inspection_date,inspector_name) VALUES(''916d0000-0000-4000-8000-000000000100'',''916d0000-0000-4000-8000-000000000200'',''Bad'',''2026-09-16'',''Tester'')')),
   ('nonmanager_storage_upload_'||n,pg_temp.expect_rejection('INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES(''compliance-documents'',''916d0000-0000-4000-8000-000000000100/sts/916d0000-0000-4000-8000-000000000400/unauthorized.pdf'',auth.uid()::text,''{"mimetype":"application/pdf","size":100}'')'));
  RESET ROLE;
 END LOOP;
END $$;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM compliance_results WHERE passed IS DISTINCT FROM true) THEN
 RAISE EXCEPTION 'Compliance authorization regression'; END IF; END $$;
SELECT count(*) AS checks,count(*) FILTER(WHERE passed) AS passed,'all fixtures rolled back' AS scope FROM compliance_results;
ROLLBACK;
