-- Simple manual submissions and receipts, retaining the existing financial ledger.
-- Patient references identify patients, so they may occur on multiple submissions.
ALTER TABLE public.billing_records
  DROP CONSTRAINT billing_records_org_reference_key,
  ADD COLUMN original_submitted_amount numeric(12,2)
    CHECK (original_submitted_amount IS NULL OR original_submitted_amount >= 0),
  ADD COLUMN request_id uuid,
  ADD COLUMN request_fingerprint text,
  ADD CONSTRAINT billing_records_org_request_key UNIQUE (org_id, request_id);
CREATE INDEX billing_records_org_reference_idx
  ON public.billing_records (org_id, internal_reference);

-- Preserve the first submitted amount rather than inferring it from later receipts.
UPDATE public.billing_records r
SET original_submitted_amount = COALESCE(
  (SELECT a.snapshot_billed_amount FROM public.billing_submission_attempts a
   WHERE a.record_id = r.id ORDER BY a.attempt_number LIMIT 1),
  CASE WHEN r.external_submitted_at IS NOT NULL THEN r.total_billed_amount END
);

ALTER TABLE public.billing_payments
  ADD COLUMN received_at timestamptz,
  ADD COLUMN request_id uuid,
  ADD COLUMN request_fingerprint text,
  ADD CONSTRAINT billing_payments_org_request_key UNIQUE (org_id, request_id);
-- Legacy date-only receipts deliberately remain date-only: do not invent a time.
CREATE INDEX billing_payments_org_received_at_idx
  ON public.billing_payments (org_id, received_at) WHERE received_at IS NOT NULL;

CREATE FUNCTION public.protect_billing_submission_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF OLD.original_submitted_amount IS NOT NULL
    AND NEW.original_submitted_amount IS DISTINCT FROM OLD.original_submitted_amount THEN
    RAISE EXCEPTION 'The original submitted amount cannot be changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_billing_submission_snapshot() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER billing_records_protect_submission_snapshot
BEFORE UPDATE OF original_submitted_amount ON public.billing_records
FOR EACH ROW EXECUTE FUNCTION public.protect_billing_submission_snapshot();

CREATE OR REPLACE FUNCTION public.sync_billing_record_financials(_record_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _billed numeric(12,2) := 0.00;
  _paid numeric(12,2) := 0.00;
  _adjusted numeric(12,2) := 0.00;
  _balance numeric(12,2) := 0.00;
  _new_settlement text := 'unpaid';
  _sub_status text;
BEGIN
  -- Lock before reading aggregates so concurrent legacy/new receipts cannot lose totals.
  PERFORM 1 FROM public.billing_records WHERE id = _record_id FOR UPDATE;

  -- Sum billed from lines
  SELECT COALESCE(SUM(billed_amount), 0.00) INTO _billed
  FROM public.billing_record_lines
  WHERE record_id = _record_id;

  -- Sum net allocations from payments
  SELECT COALESCE(SUM(bpa.amount), 0.00) INTO _paid
  FROM public.billing_payment_allocations bpa
  JOIN public.billing_payments bp ON bp.id = bpa.payment_id
  WHERE bpa.record_id = _record_id
    AND bp.received_date IS NOT NULL; -- Net confirmed receipts only!

  -- Sum adjustments
  SELECT COALESCE(SUM(amount), 0.00) INTO _adjusted
  FROM public.billing_adjustments
  WHERE record_id = _record_id;

  _balance := _billed - _paid - _adjusted;

  -- Determine settlement status
  IF _paid > 0 AND _balance <= 0 AND (_paid + _adjusted) > _billed THEN
    _new_settlement := 'overpaid';
  ELSIF _paid > 0 AND _balance <= 0 THEN
    _new_settlement := 'paid';
  ELSIF _paid > 0 AND _balance > 0 THEN
    _new_settlement := 'partially_paid';
  ELSIF _paid = 0 AND _balance <= 0 AND _adjusted >= _billed AND _billed > 0 THEN
    -- Fully adjusted/written off with zero cash receipts: remains unpaid or adjusted, NOT 'paid'
    _new_settlement := 'unpaid';
  ELSE
    _new_settlement := 'unpaid';
  END IF;

  UPDATE public.billing_records
  SET
    total_billed_amount = _billed,
    total_paid_amount = _paid,
    total_adjusted_amount = _adjusted,
    outstanding_balance = _balance,
    settlement_status = _new_settlement,
    updated_at = now()
  WHERE id = _record_id;
END;
$$;


-- This checked command is the only new public receipt-writing surface. The stable
-- request key makes retries safe; a reused key with changed input is rejected.
CREATE FUNCTION public.record_billing_receipt(p_record_id uuid, p_receipt jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _record public.billing_records%ROWTYPE;
  _existing public.billing_payments%ROWTYPE;
  _request_id uuid := (p_receipt->>'request_id')::uuid;
  _fingerprint text := md5((p_receipt - 'request_id')::text);
  _amount numeric := (p_receipt->>'amount')::numeric;
  _received_at timestamptz := (p_receipt->>'received_at')::timestamptz;
  _method text := COALESCE(NULLIF(p_receipt->>'payment_method', ''), 'other');
  _payment_id uuid := gen_random_uuid();
  _reference text;
  _result jsonb;
BEGIN
  SELECT * INTO _record FROM public.billing_records WHERE id = p_record_id;
  IF _record.id IS NULL OR NOT public.has_billing_permission(_record.org_id, 'record_payments') THEN
    RAISE EXCEPTION 'You do not have permission to receive payments for this record' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL THEN
    RAISE EXCEPTION 'A receipt request ID is required' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('billing-receipt:' || _record.org_id || ':' || _request_id, 0));
  SELECT * INTO _existing FROM public.billing_payments
    WHERE org_id = _record.org_id AND request_id = _request_id;
  IF FOUND THEN
    IF _existing.request_fingerprint IS DISTINCT FROM _fingerprint OR NOT EXISTS (
      SELECT 1 FROM public.billing_payment_allocations
      WHERE payment_id = _existing.id AND record_id = p_record_id
    ) THEN
      RAISE EXCEPTION 'This receipt request ID was already used for different details' USING ERRCODE = '23514';
    END IF;
    RETURN to_jsonb(_existing);
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 9999999999.99 OR _amount != round(_amount, 2) THEN
    RAISE EXCEPTION 'Received amount must be positive with at most two decimal places' USING ERRCODE = '23514';
  END IF;
  IF _received_at IS NULL OR NOT isfinite(_received_at) THEN
    RAISE EXCEPTION 'A valid received date and time is required' USING ERRCODE = '23514';
  END IF;
  IF _method NOT IN ('check', 'eft', 'ach', 'credit_card', 'virtual_card', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO _record FROM public.billing_records WHERE id = p_record_id FOR UPDATE;
  IF _record.submission_status IN ('cancelled', 'superseded') THEN
    RAISE EXCEPTION 'Cannot add receipts to a cancelled or replaced record' USING ERRCODE = '23514';
  END IF;
  IF _record.external_submitted_at IS NOT NULL AND _received_at < _record.external_submitted_at THEN
    RAISE EXCEPTION 'Received date and time cannot precede submission' USING ERRCODE = '23514';
  END IF;
  _reference := COALESCE(NULLIF(btrim(p_receipt->>'reference_number'), ''), 'RCPT-' || split_part(_payment_id::text, '-', 1));
  INSERT INTO public.billing_payments (
    id, org_id, payer_id, amount, payment_method, reference_number,
    received_at, received_date, reconciliation_status, unapplied_amount,
    notes, created_by, request_id, request_fingerprint
  ) VALUES (
    _payment_id, _record.org_id, _record.payer_id, _amount, _method, _reference,
    _received_at, (_received_at AT TIME ZONE 'UTC')::date, 'fully_applied', 0,
    NULLIF(btrim(p_receipt->>'notes'), ''), auth.uid(), _request_id, _fingerprint
  );
  INSERT INTO public.billing_payment_allocations (payment_id, record_id, org_id, amount, allocated_by)
    VALUES (_payment_id, p_record_id, _record.org_id, _amount, auth.uid());
  PERFORM public.sync_billing_record_financials(p_record_id);
  INSERT INTO public.billing_activity_logs (record_id, org_id, event_type, occurred_at, actor_id, notes, payload)
    VALUES (p_record_id, _record.org_id, 'payment_received', _received_at, auth.uid(),
      'Received payment', jsonb_build_object('payment_id', _payment_id, 'amount', _amount, 'reference_number', _reference));
  SELECT to_jsonb(p) INTO _result FROM public.billing_payments p WHERE id = _payment_id;
  RETURN _result;
END;
$$;

CREATE FUNCTION public.create_manual_billing_record(p_record jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _org_id uuid := (p_record->>'org_id')::uuid;
  _client_id uuid := (p_record->>'client_id')::uuid;
  _request_id uuid := (p_record->>'request_id')::uuid;
  _fingerprint text := md5((p_record - 'request_id')::text);
  _agency_name text := btrim(p_record->>'agency_name');
  _amount numeric := (p_record->>'submitted_amount')::numeric;
  _submitted_at timestamptz := (p_record->>'submitted_at')::timestamptz;
  _received_amount numeric := (p_record->>'received_amount')::numeric;
  _received_at timestamptz := (p_record->>'received_at')::timestamptz;
  _period_start date;
  _period_end date;
  _payer_id uuid;
  _record_id uuid;
  _existing public.billing_records%ROWTYPE;
  _result jsonb;
BEGIN
  IF NOT public.has_billing_permission(_org_id, 'manage_billing_records') THEN
    RAISE EXCEPTION 'You do not have permission to add billing records' USING ERRCODE = '42501';
  END IF;
  IF _request_id IS NULL THEN
    RAISE EXCEPTION 'A billing request ID is required' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('billing-record:' || _org_id || ':' || _request_id, 0));
  SELECT * INTO _existing FROM public.billing_records WHERE org_id = _org_id AND request_id = _request_id;
  IF FOUND THEN
    IF _existing.request_fingerprint IS DISTINCT FROM _fingerprint THEN
      RAISE EXCEPTION 'This billing request ID was already used for different details' USING ERRCODE = '23514';
    END IF;
    RETURN to_jsonb(_existing);
  END IF;
  IF _client_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.patients WHERE id = _client_id AND org_id = _org_id) THEN
    RAISE EXCEPTION 'Select a patient in this organization' USING ERRCODE = '23514';
  END IF;
  IF _agency_name IS NULL OR length(_agency_name) = 0 OR length(_agency_name) > 200 THEN
    RAISE EXCEPTION 'Agency name must contain between 1 and 200 characters' USING ERRCODE = '23514';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 9999999999.99 OR _amount != round(_amount, 2) THEN
    RAISE EXCEPTION 'Submitted amount must be positive with at most two decimal places' USING ERRCODE = '23514';
  END IF;
  IF _submitted_at IS NULL OR NOT isfinite(_submitted_at) THEN
    RAISE EXCEPTION 'A valid submission date and time is required' USING ERRCODE = '23514';
  END IF;
  IF (_received_amount IS NULL) != (_received_at IS NULL) THEN
    RAISE EXCEPTION 'Received amount and date/time must be entered together' USING ERRCODE = '23514';
  END IF;
  _period_start := COALESCE((p_record->>'billing_period_start')::date, (_submitted_at AT TIME ZONE 'UTC')::date);
  _period_end := COALESCE((p_record->>'billing_period_end')::date, _period_start);
  IF NOT isfinite(_period_start) OR NOT isfinite(_period_end) OR _period_end < _period_start THEN
    RAISE EXCEPTION 'Billing period dates are invalid' USING ERRCODE = '23514';
  END IF;
  -- Serialize name lookup/creation without exposing a payer-management workflow.
  PERFORM pg_advisory_xact_lock(hashtextextended('billing-agency:' || _org_id || ':' || lower(_agency_name), 0));
  SELECT id INTO _payer_id FROM public.billing_payers
    WHERE org_id = _org_id AND lower(btrim(name)) = lower(_agency_name)
    ORDER BY is_active DESC, created_at, id LIMIT 1;
  IF _payer_id IS NULL THEN
    INSERT INTO public.billing_payers (org_id, name, payer_type, submission_channel, created_by)
      VALUES (_org_id, _agency_name, 'other', 'other', auth.uid())
      ON CONFLICT (org_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO _payer_id;
  END IF;
  _result := public.create_billing_record(jsonb_build_object(
    'org_id', _org_id, 'record_type', 'partner_invoice', 'payer_id', _payer_id,
    'client_id', _client_id, 'internal_reference', split_part(_client_id::text, '-', 1),
    'billing_period_start', _period_start, 'billing_period_end', _period_end,
    'submission_status', 'submitted', 'external_submitted_at', _submitted_at,
    'original_external_reference', NULLIF(btrim(p_record->>'external_reference'), ''),
    'submission_channel', 'other', 'is_summary_only', true,
    'notes', NULLIF(btrim(p_record->>'notes'), '')
  ), ARRAY[jsonb_build_object(
    'client_id', _client_id, 'service_date', _period_start,
    'description', 'Submitted billing amount', 'quantity', 1,
    'unit_type', 'flat_rate', 'billed_amount', _amount
  )]);
  _record_id := (_result->>'id')::uuid;
  UPDATE public.billing_records SET original_submitted_amount = _amount,
    request_id = _request_id, request_fingerprint = _fingerprint WHERE id = _record_id;
  IF _received_amount IS NOT NULL THEN
    PERFORM public.record_billing_receipt(_record_id, jsonb_build_object(
      'request_id', _request_id, 'amount', _received_amount, 'received_at', _received_at,
      'reference_number', NULLIF(btrim(p_record->>'payment_reference'), '')
    ));
  END IF;
  SELECT to_jsonb(r) INTO _result FROM public.billing_records r WHERE id = _record_id;
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_billing_record(jsonb),
  public.record_billing_receipt(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_billing_record(jsonb),
  public.record_billing_receipt(uuid, jsonb) TO authenticated, service_role;

-- Uploaded metadata must describe an existing private object under this record.
CREATE FUNCTION public.validate_billing_document_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _target uuid := COALESCE(NEW.record_id, NEW.payment_id);
BEGIN
  IF _target IS NULL OR split_part(NEW.storage_path, '/', 1) != NEW.org_id::text
    OR split_part(NEW.storage_path, '/', 2) != _target::text
    OR split_part(NEW.storage_path, '/', 3) = ''
    OR array_length(string_to_array(NEW.storage_path, '/'), 1) != 3 THEN
    RAISE EXCEPTION 'Billing document path must match its organization and record or payment' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'billing-documents' AND name = NEW.storage_path) THEN
    RAISE EXCEPTION 'Upload the billing file before adding its metadata' USING ERRCODE = '23514';
  END IF;
  NEW.uploaded_by := COALESCE(auth.uid(), NEW.uploaded_by);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_billing_document_upload() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER billing_documents_validate_upload
BEFORE INSERT OR UPDATE OF org_id, record_id, payment_id, storage_path ON public.billing_documents
FOR EACH ROW EXECUTE FUNCTION public.validate_billing_document_upload();

UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/csv', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
] WHERE id = 'billing-documents';

NOTIFY pgrst, 'reload schema';
