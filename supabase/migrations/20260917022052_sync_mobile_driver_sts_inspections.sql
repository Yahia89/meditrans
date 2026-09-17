-- Preserve the device's complete submitted daily checklist in the shared STS
-- register. Legacy MMKV reports are uploaded by their verified current driver;
-- a bare drivers.inspection_date is never fabricated into a submission.
ALTER TABLE public.driver_sts_inspections
 ADD COLUMN source text NOT NULL DEFAULT 'web_crm',
 ADD COLUMN source_record_id text,
 ADD COLUMN inspection_payload jsonb,
 ADD CONSTRAINT driver_sts_inspections_source_check CHECK(
  (source='web_crm' AND source_record_id IS NULL AND inspection_payload IS NULL)
  OR (source='mobile_app' AND source_record_id IS NOT NULL AND inspection_payload IS NOT NULL
   AND jsonb_typeof(inspection_payload)='object'
   AND source_record_id=driver_id::text||'_'||inspection_date::text
   AND (inspection_payload->>'id') IS NOT DISTINCT FROM source_record_id
   AND (inspection_payload->>'driverId') IS NOT DISTINCT FROM driver_id::text
   AND (inspection_payload->>'date') IS NOT DISTINCT FROM inspection_date::text)
 );
CREATE UNIQUE INDEX driver_sts_inspections_mobile_source_key
 ON public.driver_sts_inspections(org_id,driver_id,source_record_id) WHERE source='mobile_app';

CREATE FUNCTION private.owns_active_inspection_driver(p_org_id uuid,p_driver_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.is_member_of(p_org_id)
  AND EXISTS(SELECT 1 FROM public.drivers d WHERE d.id=p_driver_id AND d.org_id=p_org_id
    AND d.user_id=(SELECT auth.uid()) AND d.active IS NOT FALSE)
$$;
CREATE FUNCTION private.current_driver_inspection_marker()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 RETURN NULLIF(pg_catalog.current_setting('app.submit_driver_sts_inspection',true),'')::jsonb;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END $$;
CREATE FUNCTION private.is_driver_inspection_rpc(p_id uuid,p_org_id uuid,p_driver_id uuid,p_source_record_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(
  private.owns_active_inspection_driver(p_org_id,p_driver_id)
  AND (private.current_driver_inspection_marker()->>'actor_id')=auth.uid()::text
  AND (private.current_driver_inspection_marker()->>'record_id')=p_id::text
  AND (private.current_driver_inspection_marker()->>'org_id')=p_org_id::text
  AND (private.current_driver_inspection_marker()->>'driver_id')=p_driver_id::text
  AND (private.current_driver_inspection_marker()->>'source_record_id')=p_source_record_id,false)
$$;
REVOKE ALL ON FUNCTION private.owns_active_inspection_driver(uuid,uuid),private.current_driver_inspection_marker(),private.is_driver_inspection_rpc(uuid,uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.owns_active_inspection_driver(uuid,uuid),private.current_driver_inspection_marker(),private.is_driver_inspection_rpc(uuid,uuid,uuid,text) TO authenticated;
CREATE POLICY compliance_sts_driver_read ON public.driver_sts_inspections FOR SELECT TO authenticated
 USING(source='mobile_app' AND private.owns_active_inspection_driver(org_id,driver_id));
CREATE POLICY compliance_sts_driver_rpc_insert ON public.driver_sts_inspections FOR INSERT TO authenticated
 WITH CHECK(source='mobile_app' AND private.is_driver_inspection_rpc(id,org_id,driver_id,source_record_id));
CREATE POLICY compliance_sts_driver_rpc_update ON public.driver_sts_inspections FOR UPDATE TO authenticated
 USING(source='mobile_app' AND private.owns_active_inspection_driver(org_id,driver_id))
 WITH CHECK(source='mobile_app' AND private.is_driver_inspection_rpc(id,org_id,driver_id,source_record_id));

CREATE FUNCTION private.validate_driver_inspection_payload(p_payload jsonb)
RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE entry jsonb; field text; parsed_date date; parsed_time timestamptz;
 expected_keys text[]:=ARRAY['vehicle_brakes','parking_brake','steering_mechanism','lighting_devices','tires','horn','wipers','mirrors','emergency_equipment','wheelchair_ramps','wheelchair_securement','remarks'];
BEGIN
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>100000 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Inspection payload must be an object smaller than 100 KB';
 END IF;
 FOREACH field IN ARRAY ARRAY['id','driverId','date','dayOfWeek','submittedAt'] LOOP
  IF jsonb_typeof(p_payload->field) IS DISTINCT FROM 'string' OR length(btrim(p_payload->>field))=0 OR length(p_payload->>field)>200 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Inspection identity and submission fields must be nonempty strings';
  END IF;
 END LOOP;
 IF (p_payload->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
  OR (p_payload->>'submittedAt') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
  OR (p_payload->>'driverId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  OR p_payload->>'id' IS DISTINCT FROM (p_payload->>'driverId')||'_'||(p_payload->>'date') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Inspection identity must match its driver and date';
 END IF;
 BEGIN
  parsed_date:=(p_payload->>'date')::date;
  parsed_time:=(p_payload->>'submittedAt')::timestamptz;
 EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Inspection date or submission timestamp is invalid';
 END;
 IF NOT isfinite(parsed_date) OR NOT isfinite(parsed_time) OR parsed_date::text<>p_payload->>'date' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Inspection date and timestamp must be finite';
 END IF;
 IF jsonb_typeof(p_payload->'driverInfo') IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Inspection driver and vehicle snapshot is required';
 END IF;
 FOREACH field IN ARRAY ARRAY['driverName','mndotNumber','make','model','year','licensePlate','mileage'] LOOP
  IF jsonb_typeof(p_payload->'driverInfo'->field) IS DISTINCT FROM 'string' OR length(p_payload->'driverInfo'->>field)>500 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Driver and vehicle fields must be bounded strings';
  END IF;
 END LOOP;
 IF length(btrim(p_payload->'driverInfo'->>'driverName')) NOT BETWEEN 1 AND 200
   OR btrim(p_payload->'driverInfo'->>'mileage') !~ '^\d{1,7}$' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Inspection driver name and a valid mileage are required';
 END IF;
 IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='The complete 12-item inspection checklist is required';
 END IF;
 IF jsonb_array_length(p_payload->'items')<>12
  OR (SELECT count(DISTINCT item->>'key') FROM jsonb_array_elements(p_payload->'items') item)<>12 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='The complete 12-item inspection checklist is required';
 END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
  IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR (entry->>'key') IS NULL
    OR NOT (entry->>'key'=ANY(expected_keys))
    OR jsonb_typeof(entry->'label') IS DISTINCT FROM 'string' OR length(btrim(entry->>'label')) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(entry->'status') IS DISTINCT FROM 'string' OR entry->>'status' NOT IN ('good','no_good')
    OR (entry ? 'explanation' AND (jsonb_typeof(entry->'explanation') IS DISTINCT FROM 'string' OR length(entry->>'explanation')>10000))
    OR (entry->>'status'='no_good' AND entry->>'key'<>'remarks' AND NULLIF(btrim(entry->>'explanation'),'') IS NULL) THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Each checklist item needs a valid status and issues need an explanation';
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.validate_driver_inspection_payload(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.validate_driver_inspection_payload(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION private.stamp_compliance_record()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); actor_name text; driver_rpc boolean:=false;
BEGIN
 IF TG_TABLE_NAME='driver_sts_inspections' THEN
  driver_rpc:=NEW.source='mobile_app' AND private.is_driver_inspection_rpc(NEW.id,NEW.org_id,NEW.driver_id,NEW.source_record_id);
  IF TG_OP='INSERT' THEN
   IF NEW.source='mobile_app' AND NOT driver_rpc THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Mobile inspection submissions must use submit_driver_sts_inspection';
   END IF;
  ELSE
   IF (NEW.source IS DISTINCT FROM OLD.source OR NEW.source_record_id IS DISTINCT FROM OLD.source_record_id
      OR NEW.inspection_payload IS DISTINCT FROM OLD.inspection_payload) AND NOT driver_rpc THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Original mobile inspection evidence cannot be edited directly';
   END IF;
   IF OLD.source='mobile_app' AND NEW.inspection_date IS DISTINCT FROM OLD.inspection_date THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Original mobile inspection date cannot be changed';
   END IF;
   IF driver_rpc AND (to_jsonb(NEW)-ARRAY['inspection_payload','updated_by','updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['inspection_payload','updated_by','updated_at']) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Driver edits may update only their submitted inspection payload';
   END IF;
  END IF;
 END IF;
 IF actor IS NULL OR NOT (private.can_manage_compliance_documents(NEW.org_id) OR driver_rpc) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Only an owner or admin of this organization can manage compliance records';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.created_at IS DISTINCT FROM now() OR NEW.updated_at IS DISTINCT FROM now()
    OR NEW.updated_by IS DISTINCT FROM actor THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Compliance audit metadata is server managed';
  END IF;
  IF TG_TABLE_NAME='company_documents' THEN
   IF NEW.uploaded_by IS DISTINCT FROM actor OR NEW.uploaded_by_name IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Compliance uploader attribution is server managed';
   END IF;
   SELECT NULLIF(btrim(full_name),'') INTO actor_name FROM public.user_profiles WHERE user_id=actor;
   NEW.uploaded_by_name:=coalesce(actor_name,actor::text);
  ELSE
   IF NEW.created_by IS DISTINCT FROM actor THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Compliance creator attribution is server managed';
   END IF;
  END IF;
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.org_id IS DISTINCT FROM OLD.org_id
   OR NEW.created_at IS DISTINCT FROM OLD.created_at
   OR NEW.updated_by IS DISTINCT FROM OLD.updated_by OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Compliance identity and audit metadata cannot be edited';
  END IF;
  IF TG_TABLE_NAME='company_documents' THEN
   IF NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by OR NEW.uploaded_by_name IS DISTINCT FROM OLD.uploaded_by_name
    OR NEW.file_path IS DISTINCT FROM OLD.file_path OR NEW.original_filename IS DISTINCT FROM OLD.original_filename
    OR NEW.file_type IS DISTINCT FROM OLD.file_type OR NEW.file_size IS DISTINCT FROM OLD.file_size THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Original company file and uploader attribution cannot be edited';
   END IF;
  ELSE
   IF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Original inspection identity cannot be edited';
   END IF;
  END IF;
 END IF;
 NEW.updated_by:=actor;
 NEW.updated_at:=clock_timestamp();
 IF TG_TABLE_NAME='company_documents' THEN
  PERFORM private.validate_compliance_file(NEW.file_path,NEW.file_type,NEW.file_size);
 ELSIF NOT driver_rpc AND NEW.report_file_path IS NOT NULL THEN
  PERFORM private.validate_compliance_file(NEW.report_file_path,NEW.report_file_type,NEW.report_file_size);
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.submit_driver_sts_inspection(
 p_org_id uuid,p_payload jsonb,p_expected_updated_at timestamptz DEFAULT NULL
) RETURNS public.driver_sts_inspections
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); driver uuid; report_date date; source_key text;
 row_data public.driver_sts_inspections%ROWTYPE; new_id uuid; summary text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='Authentication is required'; END IF;
 PERFORM private.validate_driver_inspection_payload(p_payload);
 driver:=(p_payload->>'driverId')::uuid; report_date:=(p_payload->>'date')::date; source_key:=p_payload->>'id';
 IF NOT private.owns_active_inspection_driver(p_org_id,driver) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Only the active driver can submit their own organization inspection';
 END IF;
 -- Serialize simultaneous first uploads for the same daily report. No actor,
 -- result, organization, or audit timestamp is accepted from the raw payload.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('driver-sts:'||p_org_id::text||':'||source_key,0));
 SELECT * INTO row_data FROM public.driver_sts_inspections
  WHERE org_id=p_org_id AND driver_id=driver AND source='mobile_app' AND source_record_id=source_key FOR UPDATE;
 IF FOUND THEN
  IF row_data.inspection_payload=p_payload THEN RETURN row_data; END IF;
  IF p_expected_updated_at IS NULL OR p_expected_updated_at IS DISTINCT FROM row_data.updated_at
    OR (p_payload->>'submittedAt')::timestamptz <= (row_data.inspection_payload->>'submittedAt')::timestamptz THEN
   RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Inspection changed elsewhere; refresh before saving this local revision';
  END IF;
  new_id:=row_data.id;
 ELSE
  IF p_expected_updated_at IS NOT NULL THEN
   RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Inspection revision no longer exists; refresh before saving';
  END IF;
  new_id:=gen_random_uuid();
 END IF;
 PERFORM pg_catalog.set_config('app.submit_driver_sts_inspection',jsonb_build_object(
  'actor_id',actor,'record_id',new_id,'org_id',p_org_id,'driver_id',driver,'source_record_id',source_key)::text,true);
 IF row_data.id IS NOT NULL THEN
  UPDATE public.driver_sts_inspections SET inspection_payload=p_payload
   WHERE id=row_data.id RETURNING * INTO row_data;
 ELSE
  SELECT 'Initial mobile checklist summary. Pending review; see the current submitted checklist for subsequent driver edits.'||E'\n'||
   string_agg((item->>'label')||': '||CASE WHEN item->>'status'='good' THEN 'Good' ELSE 'No good' END||
    CASE WHEN NULLIF(btrim(item->>'explanation'),'') IS NULL THEN '' ELSE ' — '||(item->>'explanation') END,E'\n' ORDER BY ordinal)
   INTO summary FROM jsonb_array_elements(p_payload->'items') WITH ORDINALITY entries(item,ordinal);
  IF length(summary)>10000 THEN
   summary:='Initial daily vehicle checklist submitted from the mobile app. Pending review. See the complete current checklist for all findings and explanations.';
  END IF;
  INSERT INTO public.driver_sts_inspections(id,org_id,driver_id,title,inspection_date,inspector_name,result,notes,source,source_record_id,inspection_payload)
   VALUES(new_id,p_org_id,driver,'Daily STS vehicle inspection',report_date,btrim(p_payload->'driverInfo'->>'driverName'),
    'pending',summary,'mobile_app',source_key,p_payload) RETURNING * INTO row_data;
 END IF;
 PERFORM pg_catalog.set_config('app.submit_driver_sts_inspection','',true);
 RETURN row_data;
END $$;
REVOKE ALL ON FUNCTION public.submit_driver_sts_inspection(uuid,jsonb,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_driver_sts_inspection(uuid,jsonb,timestamptz) TO authenticated;
COMMENT ON COLUMN public.driver_sts_inspections.inspection_payload IS 'Complete driver-submitted mobile checklist and vehicle snapshot; immutable outside the authenticated driver RPC.';
COMMENT ON FUNCTION public.submit_driver_sts_inspection(uuid,jsonb,timestamptz) IS 'Uploads an authenticated own-driver daily checklist; exact replay is idempotent and edits require the current server revision. Staff review fields are preserved.';
