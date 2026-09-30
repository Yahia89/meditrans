-- Run against the local development database with ON_ERROR_STOP=1.
-- Every fixture, payment and follow-up is rolled back.
BEGIN;

DO $$
DECLARE
  _org uuid := gen_random_uuid();
  _other_org uuid := gen_random_uuid();
  _admin uuid := gen_random_uuid();
  _dispatch uuid := gen_random_uuid();
  _other_admin uuid := gen_random_uuid();
  _patient uuid := gen_random_uuid();
  _second_patient uuid := gen_random_uuid();
  _foreign_patient uuid := gen_random_uuid();
  _payer uuid := gen_random_uuid();
  _foreign_payer uuid := gen_random_uuid();
  _foreign_trip uuid := gen_random_uuid();
  _other_client_trip uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.organizations (id, name, slug) VALUES
    (_org, 'Billing access fixture', 'billing-access-' || _org),
    (_other_org, 'Other billing access fixture', 'billing-access-' || _other_org);
  INSERT INTO auth.users (id, email) VALUES
    (_admin, _admin || '@billing-access.test'),
    (_dispatch, _dispatch || '@billing-access.test'),
    (_other_admin, _other_admin || '@billing-access.test');
  INSERT INTO public.user_profiles (user_id, full_name, default_org_id) VALUES
    (_admin, 'Billing test admin', _org),
    (_dispatch, 'Billing test dispatch', _org),
    (_other_admin, 'Other billing test admin', _other_org);
  INSERT INTO public.organization_memberships (org_id, user_id, role) VALUES
    (_org, _admin, 'admin'), (_org, _dispatch, 'dispatch'),
    (_other_org, _other_admin, 'admin');
  INSERT INTO public.patients (id, org_id, full_name)
    VALUES (_patient, _org, 'Billing access test patient'),
      (_second_patient, _org, 'Second billing access test patient'),
      (_foreign_patient, _other_org, 'Foreign billing access test patient');
  INSERT INTO public.billing_payers (id, org_id, name, payer_type)
    VALUES (_payer, _org, 'Billing access test payer', 'broker_partner'),
      (_foreign_payer, _other_org, 'Foreign billing access test payer', 'broker_partner');
  INSERT INTO public.trips (id, org_id, patient_id, pickup_location, dropoff_location, scheduled_time, status)
    VALUES (_foreign_trip, _other_org, _foreign_patient, 'Fixture pickup', 'Fixture dropoff', '2026-09-09T10:00:00Z', 'completed'),
      (_other_client_trip, _org, _second_patient, 'Fixture pickup', 'Fixture dropoff', '2026-09-09T10:00:00Z', 'completed');
  PERFORM set_config('billing_test.org', _org::text, true);
  PERFORM set_config('billing_test.admin', _admin::text, true);
  PERFORM set_config('billing_test.dispatch', _dispatch::text, true);
  PERFORM set_config('billing_test.other_admin', _other_admin::text, true);
  PERFORM set_config('billing_test.patient', _patient::text, true);
  PERFORM set_config('billing_test.payer', _payer::text, true);
  PERFORM set_config('billing_test.second_patient', _second_patient::text, true);
  PERFORM set_config('billing_test.foreign_patient', _foreign_patient::text, true);
  PERFORM set_config('billing_test.foreign_payer', _foreign_payer::text, true);
  PERFORM set_config('billing_test.foreign_trip', _foreign_trip::text, true);
  PERFORM set_config('billing_test.other_client_trip', _other_client_trip::text, true);
  PERFORM set_config('request.jwt.claim.sub', _admin::text, true);
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  _org uuid := current_setting('billing_test.org')::uuid;
  _patient uuid := current_setting('billing_test.patient')::uuid;
  _input jsonb;
  _record jsonb;
  _second jsonb;
  _receipt jsonb;
  _receipt_input jsonb;
  _record_id uuid;
  _caught boolean;
BEGIN
  _input := jsonb_build_object('org_id', _org, 'request_id', gen_random_uuid(),
    'client_id', _patient, 'agency_name', '  Manual agency  ', 'submitted_amount', '100.25',
    'submitted_at', '2026-09-10T09:45:12-05:00', 'received_amount', '25.10',
    'received_at', '2026-09-11T10:12:34-05:00', 'external_reference', 'AGENCY-123');
  _record := public.create_manual_billing_record(_input);
  _record_id := (_record->>'id')::uuid;
  PERFORM set_config('billing_test.record', _record_id::text, true);
  IF _record->>'internal_reference' != split_part(_patient::text, '-', 1)
    OR (_record->>'original_submitted_amount')::numeric != 100.25
    OR (_record->>'total_paid_amount')::numeric != 25.10
    OR (_record->>'outstanding_balance')::numeric != 75.15
    OR (_record->>'external_submitted_at')::timestamptz != '2026-09-10T14:45:12Z'::timestamptz THEN
    RAISE EXCEPTION 'Manual record did not preserve patient reference, amounts or exact time';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.billing_payments p
    JOIN public.billing_payment_allocations a ON a.payment_id = p.id
    WHERE a.record_id = _record_id AND p.received_at = '2026-09-11T15:12:34Z'
    AND p.amount = 25.10) THEN RAISE EXCEPTION 'Initial receipt time/amount missing'; END IF;
  IF public.create_manual_billing_record(_input)->>'id' != _record_id::text THEN
    RAISE EXCEPTION 'Record retry was not idempotent';
  END IF;
  BEGIN
    PERFORM public.create_manual_billing_record(_input || jsonb_build_object('submitted_amount', 200));
    RAISE EXCEPTION 'Changed input reused billing request key';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- A patient can have multiple submissions, including the same agency/date.
  _second := public.create_manual_billing_record((_input - 'received_amount' - 'received_at') ||
    jsonb_build_object('request_id', gen_random_uuid(), 'agency_name', 'manual AGENCY'));
  IF _second->>'payer_id' != _record->>'payer_id' OR _second->>'internal_reference' != _record->>'internal_reference' THEN
    RAISE EXCEPTION 'Repeated patient submissions or agency reuse failed';
  END IF;
  PERFORM set_config('billing_test.second_record', _second->>'id', true);

  _receipt_input := jsonb_build_object('request_id', gen_random_uuid(), 'amount', 75.15,
    'received_at', '2026-09-12T23:59:12-05:00', 'reference_number', 'BANK-2');
  _receipt := public.record_billing_receipt(_record_id, _receipt_input);
  IF public.record_billing_receipt(_record_id, _receipt_input)->>'id' != _receipt->>'id' THEN
    RAISE EXCEPTION 'Receipt retry was not idempotent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.billing_records WHERE id = _record_id
    AND original_submitted_amount = 100.25 AND total_paid_amount = 100.25
    AND outstanding_balance = 0 AND settlement_status = 'paid') THEN
    RAISE EXCEPTION 'Receipt totals are incorrect';
  END IF;
  BEGIN
    PERFORM public.record_billing_receipt(_record_id, _receipt_input || jsonb_build_object('amount', 5));
    RAISE EXCEPTION 'Changed receipt reused request key';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.record_billing_receipt((_second->>'id')::uuid, _receipt_input);
    RAISE EXCEPTION 'Same receipt request key accepted for another record';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM public.record_billing_receipt(_record_id, jsonb_build_object(
    'request_id', gen_random_uuid(), 'amount', '10.00', 'received_at', '2026-09-15T12:00:00Z'));
  IF NOT EXISTS (SELECT 1 FROM public.billing_records WHERE id = _record_id
    AND original_submitted_amount = 100.25 AND total_paid_amount = 110.25
    AND outstanding_balance = -10 AND settlement_status = 'overpaid') THEN
    RAISE EXCEPTION 'Overpayment was not retained';
  END IF;

  -- Atomic rejection: a bad initial receipt must not leave a record or an agency.
  BEGIN
    PERFORM public.create_manual_billing_record(_input || jsonb_build_object(
      'request_id', gen_random_uuid(), 'agency_name', 'Rejected agency', 'received_amount', 1.005));
    RAISE EXCEPTION 'Fractional cent receipt accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF EXISTS (SELECT 1 FROM public.billing_payers WHERE org_id = _org AND name = 'Rejected agency') THEN
    RAISE EXCEPTION 'Failed record left an agency behind';
  END IF;
  BEGIN
    PERFORM public.create_manual_billing_record(_input || jsonb_build_object(
      'request_id', gen_random_uuid(), 'client_id', current_setting('billing_test.foreign_patient')));
    RAISE EXCEPTION 'Foreign patient accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.create_manual_billing_record(_input || jsonb_build_object(
      'request_id', gen_random_uuid(), 'submitted_amount', 0));
    RAISE EXCEPTION 'Zero submission accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.create_manual_billing_record(_input || jsonb_build_object(
      'request_id', gen_random_uuid(), 'received_at', NULL));
    RAISE EXCEPTION 'Receipt missing timestamp accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.record_billing_receipt(_record_id, jsonb_build_object(
      'request_id', gen_random_uuid(), 'amount', 1, 'received_at', '2026-09-01T12:00:00Z'));
    RAISE EXCEPTION 'Receipt before submission accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  BEGIN
    UPDATE public.billing_records SET original_submitted_amount = 1 WHERE id = _record_id;
    RAISE EXCEPTION 'Direct original amount update accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.billing_payments SET received_at = now() WHERE request_id IS NOT NULL;
    RAISE EXCEPTION 'Direct receipt modification accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$$;

-- A privileged legacy operation also cannot rewrite the original snapshot.
RESET ROLE;
DO $$
BEGIN
  BEGIN
    UPDATE public.billing_records SET original_submitted_amount = 1
      WHERE id = current_setting('billing_test.record')::uuid;
    RAISE EXCEPTION 'Original submitted snapshot is mutable';
  EXCEPTION WHEN check_violation THEN NULL; END;
END;
$$;

SET LOCAL ROLE authenticated;
-- Exercise actual storage RLS and metadata checks; these SQL-only fixtures roll back.
INSERT INTO storage.objects (bucket_id, name, owner_id)
VALUES ('billing-documents', current_setting('billing_test.org') || '/' || current_setting('billing_test.record') || '/fixture.pdf', current_setting('billing_test.admin'));
INSERT INTO public.billing_documents (org_id, record_id, storage_path, file_name, file_size, mime_type, document_type)
VALUES (current_setting('billing_test.org')::uuid, current_setting('billing_test.record')::uuid,
  current_setting('billing_test.org') || '/' || current_setting('billing_test.record') || '/fixture.pdf',
  'fixture.pdf', 100, 'application/pdf', 'invoice_copy');
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.billing_documents WHERE record_id = current_setting('billing_test.record')::uuid
    AND uploaded_by = current_setting('billing_test.admin')::uuid) THEN
    RAISE EXCEPTION 'Upload actor not recorded';
  END IF;
  BEGIN
    INSERT INTO public.billing_documents (org_id, record_id, storage_path, file_name, file_size, mime_type, document_type)
    VALUES (current_setting('billing_test.org')::uuid, current_setting('billing_test.record')::uuid,
      current_setting('billing_test.org') || '/' || current_setting('billing_test.second_record') || '/fixture.pdf',
      'fixture.pdf', 100, 'application/pdf', 'invoice_copy');
    RAISE EXCEPTION 'Mismatched document path accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.billing_documents (org_id, record_id, storage_path, file_name, file_size, mime_type, document_type)
    VALUES (current_setting('billing_test.org')::uuid, current_setting('billing_test.record')::uuid,
      current_setting('billing_test.org') || '/' || current_setting('billing_test.record') || '/missing.pdf',
      'missing.pdf', 100, 'application/pdf', 'invoice_copy');
    RAISE EXCEPTION 'Missing storage object accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END;
$$;

DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', current_setting('billing_test.other_admin'), true);
  IF EXISTS (SELECT 1 FROM public.billing_records WHERE id = current_setting('billing_test.record')::uuid)
    OR EXISTS (SELECT 1 FROM storage.objects WHERE name LIKE current_setting('billing_test.org') || '/%') THEN
    RAISE EXCEPTION 'Foreign organization can read billing data/files';
  END IF;
  BEGIN
    PERFORM public.record_billing_receipt(current_setting('billing_test.record')::uuid,
      jsonb_build_object('request_id', gen_random_uuid(), 'amount', 5, 'received_at', now()));
    RAISE EXCEPTION 'Foreign organization can receive payments';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('billing-documents',
      current_setting('billing_test.org') || '/' || current_setting('billing_test.record') || '/foreign.pdf');
    RAISE EXCEPTION 'Foreign organization can upload billing files';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  PERFORM set_config('request.jwt.claim.sub', current_setting('billing_test.dispatch'), true);
  BEGIN
    PERFORM public.create_manual_billing_record(jsonb_build_object('org_id', current_setting('billing_test.org')));
    RAISE EXCEPTION 'Dispatch can create billing';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.record_billing_receipt(current_setting('billing_test.record')::uuid, '{}'::jsonb);
    RAISE EXCEPTION 'Dispatch can receive payments';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.create_manual_billing_record('{}'::jsonb);
    RAISE EXCEPTION 'Anonymous manual record execution allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.record_billing_receipt(gen_random_uuid(), '{}'::jsonb);
    RAISE EXCEPTION 'Anonymous receipt execution allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$$;
RESET ROLE;
ROLLBACK;
