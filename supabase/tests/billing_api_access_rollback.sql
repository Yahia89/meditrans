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
  _payer uuid := current_setting('billing_test.payer')::uuid;
  _record jsonb;
  _id uuid;
  _amount numeric;
BEGIN
  _record := public.create_billing_record(
    jsonb_build_object(
      'org_id', _org, 'record_type', 'partner_invoice', 'payer_id', _payer,
      'billing_period_start', '2026-09-01', 'billing_period_end', '2026-09-30',
      'submission_status', 'submitted', 'external_submitted_at', '2026-09-10T10:00:00Z'
    ), ARRAY[jsonb_build_object(
      'client_id', current_setting('billing_test.patient'),
      'service_date', '2026-09-09', 'description', 'Local authorization test',
      'quantity', 1, 'unit_type', 'one_way_trips', 'billed_amount', 100
    )]
  );
  _id := (_record->>'id')::uuid;
  PERFORM set_config('billing_test.record', _id::text, true);
  IF NOT EXISTS (SELECT 1 FROM public.billing_records WHERE id = _id) THEN
    RAISE EXCEPTION 'Authorized admin cannot read created record';
  END IF;

  UPDATE public.billing_records
    SET next_follow_up_date = '2026-10-01', follow_up_notes = 'Local fixture', updated_at = now()
    WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Authorized follow-up update failed'; END IF;

  BEGIN
    UPDATE public.billing_records SET total_paid_amount = 999 WHERE id = _id;
    RAISE EXCEPTION 'Direct ledger update unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.sync_billing_record_financials(_id);
    RAISE EXCEPTION 'Internal totals helper unexpectedly callable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM public.record_payment_and_allocations(
    jsonb_build_object(
      'org_id', _org, 'payer_id', _payer, 'amount', 40,
      'payment_method', 'check', 'reference_number', 'LOCAL-ACCESS-TEST',
      'received_date', '2026-09-20'
    ), ARRAY[jsonb_build_object('record_id', _id, 'amount', 40)]
  );
  SELECT outstanding_balance INTO _amount FROM public.billing_records WHERE id = _id;
  IF _amount <> 60 THEN RAISE EXCEPTION 'Payment RPC did not update totals: %', _amount; END IF;

  PERFORM set_config('request.jwt.claim.sub', current_setting('billing_test.dispatch'), true);
  IF EXISTS (SELECT 1 FROM public.billing_records WHERE id = _id) THEN
    RAISE EXCEPTION 'Dispatch role can read billing record';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', current_setting('billing_test.other_admin'), true);
  IF EXISTS (SELECT 1 FROM public.billing_records WHERE id = _id) THEN
    RAISE EXCEPTION 'Other tenant admin can read billing record';
  END IF;
  UPDATE public.billing_records SET follow_up_notes = 'Forbidden' WHERE id = _id;
  IF FOUND THEN RAISE EXCEPTION 'Other tenant admin can update follow-up'; END IF;
END;
$$;

DO $$
DECLARE
  _header jsonb;
  _line jsonb;
  _case jsonb;
  _cases jsonb[];
  _created jsonb;
  _other_line uuid;
  _before_records integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', current_setting('billing_test.admin'), true);
  _header := jsonb_build_object(
    'org_id', current_setting('billing_test.org'), 'record_type', 'dhs_claim',
    'payer_id', current_setting('billing_test.payer'),
    'client_id', current_setting('billing_test.patient'),
    'billing_period_start', '2026-09-01', 'billing_period_end', '2026-09-30'
  );
  _line := jsonb_build_object(
    'client_id', current_setting('billing_test.patient'),
    'service_date', '2026-09-09', 'description', 'Reference integrity fixture',
    'quantity', 1, 'unit_type', 'one_way_trips', 'billed_amount', 25
  );
  _cases := ARRAY[
    jsonb_build_object('label', 'foreign payer', 'header', jsonb_build_object('payer_id', current_setting('billing_test.foreign_payer'))),
    jsonb_build_object('label', 'foreign header client', 'header', jsonb_build_object('client_id', current_setting('billing_test.foreign_patient'))),
    jsonb_build_object('label', 'foreign line client', 'line', jsonb_build_object('client_id', current_setting('billing_test.foreign_patient'))),
    jsonb_build_object('label', 'different DHS client', 'line', jsonb_build_object('client_id', current_setting('billing_test.second_patient'))),
    jsonb_build_object('label', 'foreign trip', 'line', jsonb_build_object('trip_id', current_setting('billing_test.foreign_trip'))),
    jsonb_build_object('label', 'trip for another client', 'line', jsonb_build_object('trip_id', current_setting('billing_test.other_client_trip')))
  ];
  SELECT count(*) INTO _before_records FROM public.billing_records;
  FOREACH _case IN ARRAY _cases LOOP
    BEGIN
      PERFORM public.create_billing_record(
        _header || COALESCE(_case->'header', '{}'::jsonb),
        ARRAY[_line || COALESCE(_case->'line', '{}'::jsonb)]
      );
      RAISE EXCEPTION 'Invalid reference unexpectedly accepted: %', _case->>'label';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  IF (SELECT count(*) FROM public.billing_records) <> _before_records THEN
    RAISE EXCEPTION 'Rejected record creation left partial billing headers';
  END IF;

  -- Multi-client partner invoices remain valid, including a correctly matched trip.
  _created := public.create_billing_record(
    _header || jsonb_build_object('record_type', 'partner_invoice', 'client_id', NULL),
    ARRAY[_line, _line || jsonb_build_object(
      'client_id', current_setting('billing_test.second_patient'),
      'trip_id', current_setting('billing_test.other_client_trip')
    )]
  );
  IF (_created->>'total_billed_amount')::numeric <> 50 THEN
    RAISE EXCEPTION 'Valid multi-client partner invoice failed';
  END IF;
  SELECT id INTO _other_line FROM public.billing_record_lines
    WHERE record_id = (_created->>'id')::uuid LIMIT 1;

  BEGIN
    PERFORM public.record_payment_and_allocations(
      jsonb_build_object(
        'org_id', current_setting('billing_test.org'), 'payer_id', current_setting('billing_test.foreign_payer'),
        'amount', 10, 'payment_method', 'check', 'reference_number', 'FOREIGN-PAYER-TEST'
      ), ARRAY[]::jsonb[]
    );
    RAISE EXCEPTION 'Foreign payer payment unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.record_payment_and_allocations(
      jsonb_build_object(
        'org_id', current_setting('billing_test.org'), 'payer_id', current_setting('billing_test.payer'),
        'amount', 10, 'payment_method', 'check', 'reference_number', 'WRONG-LINE-TEST'
      ), ARRAY[jsonb_build_object(
        'record_id', current_setting('billing_test.record'), 'record_line_id', _other_line, 'amount', 10
      )]
    );
    RAISE EXCEPTION 'Allocation to another record service line unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.record_adjustment(current_setting('billing_test.record')::uuid,
      jsonb_build_object('record_line_id', _other_line, 'adjustment_type', 'other', 'amount', 1, 'reason', 'Wrong line fixture'));
    RAISE EXCEPTION 'Adjustment to another record service line unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.sync_billing_record_financials(current_setting('billing_test.record')::uuid);
    RAISE EXCEPTION 'Anonymous internal helper call unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.create_billing_record('{}'::jsonb, ARRAY[]::jsonb[]);
    RAISE EXCEPTION 'Anonymous billing creation unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

RESET ROLE;
SELECT 'billing_api_access_rollback: PASS' AS result;
ROLLBACK;
