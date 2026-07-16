CREATE TABLE IF NOT EXISTS public.eta_sms_check_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  check_status text NOT NULL,
  reason text,
  eta_minutes integer,
  request_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.eta_sms_check_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS eta_sms_check_logs_trip_created_idx
  ON public.eta_sms_check_logs (trip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS eta_sms_check_logs_driver_created_idx
  ON public.eta_sms_check_logs (driver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS eta_sms_check_logs_org_created_idx
  ON public.eta_sms_check_logs (org_id, created_at DESC);

DROP POLICY IF EXISTS "Users can view eta sms check logs for their org"
  ON public.eta_sms_check_logs;

CREATE POLICY "Users can view eta sms check logs for their org"
  ON public.eta_sms_check_logs
  FOR SELECT
  TO authenticated
  USING (org_id IS NOT NULL AND public.is_member_of(org_id));

DROP POLICY IF EXISTS "Service role can manage eta sms check logs"
  ON public.eta_sms_check_logs;

CREATE POLICY "Service role can manage eta sms check logs"
  ON public.eta_sms_check_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.eta_sms_check_logs IS
  'Durable audit trail for ETA SMS checks, including skipped checks where no provider SMS attempt was made.';

COMMENT ON COLUMN public.eta_sms_check_logs.check_status IS
  'Machine-readable outcome such as sent, checked_eta_too_far, skipped_not_en_route, skipped_already_sent, skipped_no_location, skipped_no_phone, skipped_unauthorized, error_maps, or error_telnyx.';
