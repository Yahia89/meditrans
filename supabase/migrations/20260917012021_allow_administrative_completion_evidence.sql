-- Administrative completion has truthful missing GPS, while every physical
-- milestone retains the existing evidence contract. Only the atomic RPC may
-- create this new history shape; legacy writers of other shapes are unchanged.
ALTER TABLE public.trip_status_history
 DROP CONSTRAINT trip_status_history_major_event_evidence_check;
ALTER TABLE public.trip_status_history
 ADD CONSTRAINT trip_status_history_major_event_evidence_check CHECK (
  status_code IS NULL
  OR status_code <> ALL (ARRAY['en_route'::text,'loaded'::text,'completed'::text])
  OR (trigger_kind IS NOT NULL AND source_surface IS NOT NULL
    AND client_platform IS NOT NULL AND client_event_id IS NOT NULL
    AND latitude IS NOT NULL AND longitude IS NOT NULL
    AND location_source IS NOT NULL AND location_captured_at IS NOT NULL)
  OR (status_code IS NOT DISTINCT FROM 'completed' AND trigger_kind IS NOT DISTINCT FROM 'manual'
    AND source_surface IS NOT DISTINCT FROM 'web_crm' AND client_platform IS NOT DISTINCT FROM 'web'
    AND client_event_id IS NOT NULL AND actor_id IS NOT NULL
    AND latitude IS NULL AND longitude IS NULL AND location_source IS NULL
    AND location_captured_at IS NULL AND location_accuracy_m IS NULL)
 );

CREATE FUNCTION public.guard_administrative_completion_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE marker jsonb;
BEGIN
 IF NEW.status_code='completed' AND NEW.latitude IS NULL AND NEW.longitude IS NULL THEN
  marker:=public.current_trip_transition_marker();
  IF marker IS NULL OR auth.uid() IS NULL
    OR NEW.actor_id IS DISTINCT FROM auth.uid()
    OR marker->>'actor_id' IS DISTINCT FROM NEW.actor_id::text
    OR marker->>'trip_id' IS DISTINCT FROM NEW.trip_id::text
    OR marker->>'client_event_id' IS DISTINCT FROM NEW.client_event_id::text
    OR marker->>'new_status' IS DISTINCT FROM 'completed'
    OR NOT EXISTS(SELECT 1 FROM public.trips t JOIN public.organization_memberships m ON m.org_id=t.org_id
      WHERE t.id=NEW.trip_id AND m.user_id=auth.uid() AND m.role::text IN ('owner','admin','dispatch')) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Administrative completion evidence must use apply_trip_transition';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER administrative_completion_evidence_guard
 BEFORE INSERT OR UPDATE ON public.trip_status_history FOR EACH ROW
 EXECUTE FUNCTION public.guard_administrative_completion_evidence();
ALTER TABLE public.trip_status_history ENABLE ALWAYS TRIGGER administrative_completion_evidence_guard;
REVOKE ALL ON FUNCTION public.guard_administrative_completion_evidence() FROM PUBLIC,anon,authenticated,service_role;
