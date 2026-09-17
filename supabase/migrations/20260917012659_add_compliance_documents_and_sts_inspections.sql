-- Separate organization compliance records from legacy personal documents.
-- Access is limited to active same-organization owners/admins; no global role
-- bypass is introduced. File uploads are immutable and metadata is verified.
CREATE SCHEMA IF NOT EXISTS private;

CREATE FUNCTION private.can_manage_compliance_documents(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.is_member_of(p_org_id)
 AND EXISTS(SELECT 1 FROM public.organization_memberships m
  WHERE m.org_id=p_org_id AND m.user_id=(SELECT auth.uid())
    AND m.role::text IN ('owner','admin'))
$$;
CREATE FUNCTION private.compliance_object_org(p_name text)
RETURNS uuid LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(company|sts)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-]+\.(pdf|jpg|jpeg|png|webp)$'
 THEN split_part(p_name,'/',1)::uuid END
$$;
REVOKE ALL ON FUNCTION private.can_manage_compliance_documents(uuid),private.compliance_object_org(text) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_compliance_documents(uuid),private.compliance_object_org(text) TO authenticated;

ALTER TABLE public.drivers ADD CONSTRAINT drivers_org_id_id_compliance_key UNIQUE(org_id,id);
CREATE TABLE public.driver_sts_inspections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 driver_id uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
 inspection_date date NOT NULL,
 inspector_name text NOT NULL CHECK(length(btrim(inspector_name)) BETWEEN 1 AND 200),
 result text NOT NULL DEFAULT 'pending' CHECK(result IN ('passed','failed','follow_up','pending')),
 reference text CHECK(reference IS NULL OR length(reference)<=200),
 notes text CHECK(notes IS NULL OR length(notes)<=10000),
 next_due_date date CHECK(next_due_date IS NULL OR next_due_date>=inspection_date),
 report_file_path text,
 report_filename text,
 report_file_type text,
 report_file_size bigint,
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL DEFAULT auth.uid(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT driver_sts_inspections_driver_org_fk FOREIGN KEY(org_id,driver_id)
  REFERENCES public.drivers(org_id,id) ON DELETE RESTRICT,
 CONSTRAINT driver_sts_inspections_report_check CHECK(
  (report_file_path IS NULL AND report_filename IS NULL AND report_file_type IS NULL AND report_file_size IS NULL)
  OR (report_file_path IS NOT NULL AND report_filename IS NOT NULL AND report_file_type IS NOT NULL AND report_file_size IS NOT NULL
   AND length(btrim(report_filename)) BETWEEN 1 AND 255
   AND report_file_type IN ('application/pdf','image/jpeg','image/png','image/webp')
   AND report_file_size BETWEEN 1 AND 20971520
   AND private.compliance_object_org(report_file_path) IS NOT DISTINCT FROM org_id
   AND split_part(report_file_path,'/',2)='sts' AND split_part(report_file_path,'/',3)=id::text))
);
CREATE INDEX driver_sts_inspections_org_driver_date_idx ON public.driver_sts_inspections(org_id,driver_id,inspection_date DESC);
CREATE INDEX driver_sts_inspections_org_date_idx ON public.driver_sts_inspections(org_id,inspection_date DESC);

CREATE TABLE public.company_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 100),
 notes text CHECK(notes IS NULL OR length(notes)<=10000),
 audit_year integer CHECK(audit_year IS NULL OR audit_year BETWEEN 2000 AND 2100),
 file_path text NOT NULL,
 original_filename text NOT NULL CHECK(length(btrim(original_filename)) BETWEEN 1 AND 255),
 file_type text NOT NULL CHECK(file_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 file_size bigint NOT NULL CHECK(file_size BETWEEN 1 AND 20971520),
 uploaded_by uuid NOT NULL DEFAULT auth.uid(),
 uploaded_by_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL DEFAULT auth.uid(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT company_documents_path_check CHECK(private.compliance_object_org(file_path) IS NOT DISTINCT FROM org_id
  AND split_part(file_path,'/',2)='company' AND split_part(file_path,'/',3)=id::text)
);
CREATE INDEX company_documents_org_created_idx ON public.company_documents(org_id,created_at DESC);
CREATE INDEX company_documents_org_audit_year_idx ON public.company_documents(org_id,audit_year);

ALTER TABLE public.driver_sts_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_sts_read ON public.driver_sts_inspections FOR SELECT TO authenticated
 USING(private.can_manage_compliance_documents(org_id));
CREATE POLICY compliance_sts_insert ON public.driver_sts_inspections FOR INSERT TO authenticated
 WITH CHECK(private.can_manage_compliance_documents(org_id));
CREATE POLICY compliance_sts_update ON public.driver_sts_inspections FOR UPDATE TO authenticated
 USING(private.can_manage_compliance_documents(org_id)) WITH CHECK(private.can_manage_compliance_documents(org_id));
CREATE POLICY compliance_company_read ON public.company_documents FOR SELECT TO authenticated
 USING(private.can_manage_compliance_documents(org_id));
CREATE POLICY compliance_company_insert ON public.company_documents FOR INSERT TO authenticated
 WITH CHECK(private.can_manage_compliance_documents(org_id));
CREATE POLICY compliance_company_update ON public.company_documents FOR UPDATE TO authenticated
 USING(private.can_manage_compliance_documents(org_id)) WITH CHECK(private.can_manage_compliance_documents(org_id));
REVOKE ALL ON public.driver_sts_inspections,public.company_documents FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.driver_sts_inspections,public.company_documents TO authenticated;
GRANT ALL ON public.driver_sts_inspections,public.company_documents TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('compliance-documents','compliance-documents',false,20971520,
 ARRAY['application/pdf','image/jpeg','image/png','image/webp']);
CREATE POLICY compliance_files_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='compliance-documents' AND private.can_manage_compliance_documents(private.compliance_object_org(name)));
CREATE POLICY compliance_files_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='compliance-documents' AND private.can_manage_compliance_documents(private.compliance_object_org(name))
  AND owner_id=(SELECT auth.uid())::text);
CREATE POLICY compliance_files_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='compliance-documents' AND private.can_manage_compliance_documents(private.compliance_object_org(name))
  AND NOT EXISTS(SELECT 1 FROM public.company_documents d WHERE d.file_path=objects.name)
  AND NOT EXISTS(SELECT 1 FROM public.driver_sts_inspections i WHERE i.report_file_path=objects.name));
-- Restrictive guards ensure later broad policies cannot open this bucket to
-- non-managers or overwrite a referenced immutable object.
CREATE POLICY compliance_files_scope_guard ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
 USING(bucket_id<>'compliance-documents' OR private.can_manage_compliance_documents(private.compliance_object_org(name)))
 WITH CHECK(bucket_id<>'compliance-documents' OR private.can_manage_compliance_documents(private.compliance_object_org(name)));
CREATE POLICY compliance_files_immutable_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'compliance-documents') WITH CHECK(bucket_id<>'compliance-documents');
CREATE POLICY compliance_files_referenced_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'compliance-documents' OR (
  NOT EXISTS(SELECT 1 FROM public.company_documents d WHERE d.file_path=objects.name)
  AND NOT EXISTS(SELECT 1 FROM public.driver_sts_inspections i WHERE i.report_file_path=objects.name)));

CREATE FUNCTION private.validate_compliance_file(p_path text,p_type text,p_size bigint)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE object_metadata jsonb;
BEGIN
 SELECT metadata INTO object_metadata FROM storage.objects
  WHERE bucket_id='compliance-documents' AND name=p_path;
 IF NOT FOUND OR object_metadata->>'mimetype' IS DISTINCT FROM p_type
   OR (object_metadata->>'size')::bigint IS DISTINCT FROM p_size THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Upload the matching compliance file before saving its metadata';
 END IF;
END $$;
CREATE FUNCTION private.stamp_compliance_record()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); actor_name text;
BEGIN
 IF actor IS NULL OR NOT private.can_manage_compliance_documents(NEW.org_id) THEN
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
 NEW.updated_at:=now();
 IF TG_TABLE_NAME='company_documents' THEN
  PERFORM private.validate_compliance_file(NEW.file_path,NEW.file_type,NEW.file_size);
 ELSIF NEW.report_file_path IS NOT NULL THEN
  PERFORM private.validate_compliance_file(NEW.report_file_path,NEW.report_file_type,NEW.report_file_size);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER company_documents_stamp BEFORE INSERT OR UPDATE ON public.company_documents
 FOR EACH ROW EXECUTE FUNCTION private.stamp_compliance_record();
CREATE TRIGGER driver_sts_inspections_stamp BEFORE INSERT OR UPDATE ON public.driver_sts_inspections
 FOR EACH ROW EXECUTE FUNCTION private.stamp_compliance_record();
REVOKE ALL ON FUNCTION private.validate_compliance_file(text,text,bigint),private.stamp_compliance_record() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.validate_compliance_file(text,text,bigint) TO authenticated;
COMMENT ON TABLE public.driver_sts_inspections IS 'Explicit STS inspection records; legacy drivers.inspection_date is not backfilled as evidence.';
COMMENT ON COLUMN public.company_documents.uploaded_by_name IS 'Immutable server-derived uploader name snapshot retained independently of profile changes.';
