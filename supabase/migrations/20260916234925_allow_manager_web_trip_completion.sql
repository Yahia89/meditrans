-- Restore office completion without claiming an office browser location as
-- physical dropoff evidence. Same-org owners/admins/dispatchers may complete an
-- eligible trip from the manual web CRM flow with no location payload.
-- Driver GPS, signature/decline, optimistic concurrency, and replay requirements
-- remain unchanged. This migration does not install the deferred writer guards.

CREATE OR REPLACE FUNCTION public.apply_trip_transition(
  p_org_id uuid,
  p_trip_id uuid,
  p_expected_status text,
  p_new_status text,
  p_client_event_id uuid,
  p_trigger_kind text,
  p_source_surface text,
  p_client_platform text,
  p_latitude double precision,
  p_longitude double precision,
  p_location_source text,
  p_location_captured_at timestamp with time zone,
  p_location_accuracy_m double precision,
  p_signature_data text,
  p_signed_by_name text,
  p_signature_declined boolean,
  p_signature_declined_reason text,
  p_cancel_reason text DEFAULT NULL,
  p_cancel_explanation text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_status_code text;
  v_status_label text;
  v_trip public.trips%ROWTYPE;
  v_existing_event public.trip_status_history%ROWTYPE;
  v_history public.trip_status_history%ROWTYPE;
  v_cancellation_audit_id uuid;
  v_total_waiting_minutes numeric;
  v_is_assigned_driver boolean := false;
  v_is_org_manager boolean := false;
  v_is_manager_web_completion boolean := false;
  v_transition_allowed boolean := false;
  v_cancel_reason text := NULLIF(btrim(p_cancel_reason), '');
  v_cancel_explanation text := NULLIF(btrim(p_cancel_explanation), '');
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '28000',
      MESSAGE = 'Authentication is required to apply a trip transition';
  END IF;

  IF p_org_id IS NULL OR p_trip_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'org_id and trip_id are required';
  END IF;

  IF p_client_event_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'client_event_id is required';
  END IF;

  IF NULLIF(btrim(p_expected_status), '') IS NULL
     OR NULLIF(btrim(p_new_status), '') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'expected_status and new_status are required';
  END IF;

  IF p_expected_status = p_new_status THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'new_status must differ from expected_status';
  END IF;

  IF p_new_status <> ALL (ARRAY[
    'pending'::text,
    'assigned'::text,
    'accepted'::text,
    'en_route'::text,
    'arrived'::text,
    'waiting'::text,
    'in_progress'::text,
    'in_pickup_circle'::text,
    'loaded'::text,
    'in_dropoff_circle'::text,
    'completed'::text,
    'cancelled'::text,
    'no_show'::text
  ]) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = format('Unsupported trip status: %s', p_new_status);
  END IF;

  IF p_trigger_kind IS NULL
     OR p_trigger_kind <> ALL (ARRAY['manual'::text, 'automatic'::text]) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'trigger_kind must be manual or automatic';
  END IF;

  IF p_source_surface IS NULL
     OR p_source_surface <> ALL (
       ARRAY[
         'trip_list'::text,
         'trip_detail'::text,
         'map_view'::text,
         'web_crm'::text,
         'system'::text
       ]
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'source_surface is invalid';
  END IF;

  IF p_client_platform IS NULL
     OR p_client_platform <> ALL (ARRAY['ios'::text, 'android'::text, 'web'::text]) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'client_platform must be ios, android, or web';
  END IF;

  IF (p_latitude IS NULL) <> (p_longitude IS NULL) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'latitude and longitude must be provided together';
  END IF;

  IF p_latitude IS NOT NULL AND (
    p_latitude < -90
    OR p_latitude > 90
    OR p_longitude < -180
    OR p_longitude > 180
    OR (p_latitude = 0 AND p_longitude = 0)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'coordinates are outside valid ranges or equal to 0,0';
  END IF;

  IF p_location_accuracy_m IS NOT NULL AND (
    p_location_accuracy_m < 0 OR p_location_accuracy_m > 100000
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'location_accuracy_m must be between 0 and 100000';
  END IF;

  IF p_latitude IS NULL AND (
    p_location_source IS NOT NULL
    OR p_location_captured_at IS NOT NULL
    OR p_location_accuracy_m IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'location metadata cannot be supplied without coordinates';
  END IF;

  IF p_latitude IS NOT NULL AND (
    p_location_source IS NULL
    OR p_location_source <> ALL (
      ARRAY[
        'bg_live'::text,
        'navigation_sdk'::text,
        'bg_cache'::text,
        'browser_geolocation'::text
      ]
    )
    OR p_location_captured_at IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'coordinates require a valid location_source and location_captured_at';
  END IF;

  v_status_code := CASE
    WHEN p_new_status = 'in_progress' THEN 'loaded'
    ELSE p_new_status
  END;

  IF p_new_status = 'completed' THEN
    IF p_signature_declined IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '22004',
        MESSAGE = 'signature_declined is required for a completed trip';
    ELSIF p_signature_declined THEN
      IF NULLIF(btrim(p_signature_declined_reason), '') IS NULL
         OR p_signature_data IS NOT NULL
         OR p_signed_by_name IS NOT NULL THEN
        RAISE EXCEPTION USING
          ERRCODE = '22023',
          MESSAGE = 'Declined completion requires a reason and no signature payload';
      END IF;
    ELSIF NULLIF(btrim(p_signature_data), '') IS NULL
          OR NULLIF(btrim(p_signed_by_name), '') IS NULL
          OR p_signature_declined_reason IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'Signed completion requires signature_data and signed_by_name only';
    END IF;
  ELSIF p_signature_data IS NOT NULL
        OR p_signed_by_name IS NOT NULL
        OR p_signature_declined IS NOT NULL
        OR p_signature_declined_reason IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Signature fields are only valid for a completed trip';
  END IF;

  IF p_new_status = ANY (ARRAY['cancelled'::text, 'no_show'::text]) THEN
    IF v_cancel_reason IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'cancel_reason is required for cancelled and no_show transitions';
    END IF;
  ELSIF p_cancel_reason IS NOT NULL OR p_cancel_explanation IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Cancellation fields are only valid for cancelled and no_show transitions';
  END IF;

  v_status_label := CASE p_new_status
    WHEN 'pending' THEN 'PENDING'
    WHEN 'assigned' THEN 'ASSIGNED'
    WHEN 'accepted' THEN 'ACCEPTED'
    WHEN 'en_route' THEN 'EN ROUTE TO PICKUP'
    WHEN 'arrived' THEN 'ARRIVED AT PICKUP'
    WHEN 'waiting' THEN 'WAITING AT DESTINATION'
    WHEN 'in_progress' THEN 'PATIENT LOADED / IN PROGRESS'
    WHEN 'in_pickup_circle' THEN 'IN PICK UP CIRCLE'
    WHEN 'loaded' THEN 'PATIENT LOADED / IN PROGRESS'
    WHEN 'in_dropoff_circle' THEN 'IN DROP OFF CIRCLE'
    WHEN 'completed' THEN CASE
      WHEN p_signature_declined THEN 'COMPLETED (Signature Declined)'
      ELSE 'COMPLETED WITH SIGNATURE'
    END
    WHEN 'cancelled' THEN 'CANCELLED'
    WHEN 'no_show' THEN 'NO SHOW'
  END;

  -- Locking the trip serializes transitions for that trip. RLS remains active,
  -- so a missing row also covers callers who are not allowed to see it.
  SELECT t.*
  INTO v_trip
  FROM public.trips AS t
  WHERE t.id = p_trip_id
    AND t.org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Trip was not found or is not accessible';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.drivers AS d
    WHERE d.id = v_trip.driver_id
      AND d.user_id = v_actor_id
  )
  INTO v_is_assigned_driver;

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships AS m
    WHERE m.org_id = p_org_id
      AND m.user_id = v_actor_id
      AND m.role::text = ANY (ARRAY['owner'::text, 'admin'::text, 'dispatch'::text])
  )
  INTO v_is_org_manager;

  -- The exception is authorized by database membership, never by client
  -- provenance alone. Require absent coordinates so an office location cannot
  -- masquerade as physical trip evidence. The earlier validation also requires
  -- all location metadata to be NULL when coordinates are absent.
  v_is_manager_web_completion := v_is_org_manager
    AND p_new_status = 'completed'
    AND p_trigger_kind = 'manual'
    AND p_source_surface = 'web_crm'
    AND p_client_platform = 'web'
    AND p_latitude IS NULL;

  IF p_new_status = ANY (ARRAY[
    'en_route'::text,
    'arrived'::text,
    'in_pickup_circle'::text,
    'loaded'::text,
    'in_progress'::text,
    'in_dropoff_circle'::text,
    'waiting'::text,
    'completed'::text
  ]) THEN
    IF NOT (v_is_assigned_driver OR v_is_manager_web_completion) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Only the assigned driver can record physical trip milestones';
    END IF;
  ELSIF p_new_status = ANY (ARRAY['cancelled'::text, 'no_show'::text]) THEN
    IF NOT (v_is_assigned_driver OR v_is_org_manager) THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'Only the assigned driver or an organization manager can close this trip';
    END IF;
  ELSE
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'apply_trip_transition only accepts driver milestones, cancelled, or no_show';
  END IF;

  -- A committed retry returns the original event before checking the now-stale
  -- expected status. Reusing a key for a different payload is rejected.
  SELECT h.*
  INTO v_existing_event
  FROM public.trip_status_history AS h
  WHERE h.client_event_id = p_client_event_id;

  IF FOUND THEN
    IF v_existing_event.trip_id IS DISTINCT FROM p_trip_id
       OR v_existing_event.actor_id IS DISTINCT FROM v_actor_id
       OR v_existing_event.status IS DISTINCT FROM v_status_label
       OR v_existing_event.status_code IS DISTINCT FROM v_status_code
       OR v_existing_event.trigger_kind IS DISTINCT FROM p_trigger_kind
       OR v_existing_event.source_surface IS DISTINCT FROM p_source_surface
       OR v_existing_event.client_platform IS DISTINCT FROM p_client_platform
       OR v_existing_event.latitude IS DISTINCT FROM p_latitude
       OR v_existing_event.longitude IS DISTINCT FROM p_longitude
       OR v_existing_event.location_source IS DISTINCT FROM p_location_source
       OR v_existing_event.location_captured_at IS DISTINCT FROM p_location_captured_at
       OR v_existing_event.location_accuracy_m IS DISTINCT FROM p_location_accuracy_m THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'client_event_id was already used for a different transition';
    END IF;

    IF p_new_status = 'completed' AND (
      v_trip.signature_declined IS DISTINCT FROM p_signature_declined
      OR v_trip.signature_data IS DISTINCT FROM p_signature_data
      OR v_trip.signed_by_name IS DISTINCT FROM p_signed_by_name
      OR v_trip.signature_declined_reason IS DISTINCT FROM p_signature_declined_reason
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'client_event_id was already used with a different completion payload';
    END IF;

    IF p_new_status = ANY (ARRAY['cancelled'::text, 'no_show'::text]) AND (
      v_trip.cancel_reason IS DISTINCT FROM v_cancel_reason
      OR v_trip.cancel_explanation IS DISTINCT FROM v_cancel_explanation
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'client_event_id was already used with different cancellation details';
    END IF;

    IF p_new_status = ANY (ARRAY['cancelled'::text, 'no_show'::text]) THEN
      SELECT a.id
      INTO v_cancellation_audit_id
      FROM public.trip_cancellation_audits AS a
      WHERE a.client_event_id = p_client_event_id;

      -- Backfill only the matching audit if an event was committed by the
      -- earlier RPC definition before dedicated audit insertion existed.
      IF v_cancellation_audit_id IS NULL THEN
        PERFORM pg_catalog.set_config(
          'app.apply_trip_transition',
          pg_catalog.jsonb_build_object(
            'trip_id', p_trip_id,
            'actor_id', v_actor_id,
            'expected_status', v_trip.status,
            'new_status', p_new_status,
            'client_event_id', p_client_event_id
          )::text,
          true
        );

        INSERT INTO public.trip_cancellation_audits (
          trip_id,
          driver_id,
          org_id,
          reason,
          explanation,
          location_lat,
          location_lng,
          location_accuracy,
          location_timestamp,
          location_metadata,
          device_metadata,
          client_event_id
        )
        VALUES (
          p_trip_id,
          v_actor_id,
          p_org_id,
          v_cancel_reason,
          v_cancel_explanation,
          p_latitude,
          p_longitude,
          p_location_accuracy_m,
          p_location_captured_at,
          jsonb_strip_nulls(jsonb_build_object(
            'trigger_kind', p_trigger_kind,
            'source_surface', p_source_surface,
            'client_platform', p_client_platform,
            'location_source', p_location_source,
            'client_event_id', p_client_event_id
          )),
          jsonb_build_object('platform', p_client_platform),
          p_client_event_id
        )
        RETURNING id INTO v_cancellation_audit_id;

        PERFORM pg_catalog.set_config('app.apply_trip_transition', '', true);
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'trip_id', p_trip_id,
      'status', p_new_status,
      'history_id', v_existing_event.id,
      'cancellation_audit_id', v_cancellation_audit_id,
      'event_created_at', v_existing_event.created_at,
      'replayed', true
    );
  END IF;

  -- Validate new physical evidence only after the replay path. An exact
  -- idempotent retry returns the already-committed event above even after the
  -- original fix ages beyond the acceptance window.
  IF NOT v_is_manager_web_completion
     AND v_status_code = ANY (ARRAY['en_route'::text, 'loaded'::text, 'completed'::text]) THEN
    IF p_latitude IS NULL
       OR p_longitude IS NULL
       OR p_location_source IS NULL
       OR p_location_captured_at IS NULL
       OR p_location_accuracy_m IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = format(
          'Fresh, accurate location evidence is required for the %s trip event',
          v_status_code
        );
    END IF;

    -- PostgreSQL orders NaN above finite numbers, so the closed range rejects
    -- NaN and both infinities as well as negative or low-quality accuracy.
    IF NOT (
      p_location_accuracy_m >= 0
      AND p_location_accuracy_m <= 60
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Major trip event location accuracy must be between 0 and 60 meters';
    END IF;

    IF p_location_captured_at < pg_catalog.clock_timestamp() - interval '60 seconds'
       OR p_location_captured_at > pg_catalog.clock_timestamp() + interval '15 seconds' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Major trip event location timestamp is stale or too far in the future';
    END IF;
  END IF;

  IF v_trip.status IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = format(
        'Trip status changed: expected %s, found %s',
        p_expected_status,
        coalesce(v_trip.status, '<null>')
      );
  END IF;

  v_transition_allowed :=
    (
      v_trip.status = ANY (ARRAY['assigned'::text, 'accepted'::text])
      AND p_new_status = 'en_route'
    )
    OR (
      v_trip.status = 'en_route'
      AND p_new_status = ANY (
        ARRAY['arrived'::text, 'in_pickup_circle'::text, 'loaded'::text, 'in_progress'::text]
      )
    )
    OR (
      v_trip.status = 'in_pickup_circle'
      AND p_new_status = ANY (ARRAY['arrived'::text, 'loaded'::text, 'in_progress'::text])
    )
    OR (
      v_trip.status = 'arrived'
      AND p_new_status = ANY (ARRAY['loaded'::text, 'in_progress'::text])
    )
    OR (
      v_trip.status = ANY (ARRAY['loaded'::text, 'in_progress'::text])
      AND p_new_status = ANY (
        ARRAY['in_dropoff_circle'::text, 'waiting'::text, 'completed'::text]
      )
    )
    OR (
      v_trip.status = 'in_dropoff_circle'
      AND p_new_status = ANY (ARRAY['waiting'::text, 'completed'::text])
    )
    OR (v_trip.status = 'waiting' AND p_new_status = 'completed')
    OR (
      p_new_status = ANY (ARRAY['cancelled'::text, 'no_show'::text])
      AND v_trip.status <> ALL (
        ARRAY['completed'::text, 'cancelled'::text, 'no_show'::text]
      )
    );

  IF v_transition_allowed IS NOT TRUE THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format(
        'Trip transition from %s to %s is not allowed',
        coalesce(v_trip.status, '<null>'),
        p_new_status
      );
  END IF;

  SELECT NULLIF(btrim(up.full_name), '')
  INTO v_actor_name
  FROM public.user_profiles AS up
  WHERE up.user_id = v_actor_id;

  IF v_actor_name IS NULL THEN
    SELECT NULLIF(btrim(d.full_name), '')
    INTO v_actor_name
    FROM public.drivers AS d
    WHERE d.user_id = v_actor_id
    ORDER BY d.id
    LIMIT 1;
  END IF;

  v_actor_name := coalesce(
    v_actor_name,
    NULLIF(auth.jwt() ->> 'email', ''),
    v_actor_id::text
  );

  v_total_waiting_minutes := coalesce(v_trip.total_waiting_minutes, 0);
  IF v_trip.status = 'waiting'
     AND p_new_status <> 'waiting'
     AND v_trip.waiting_start_time IS NOT NULL THEN
    v_total_waiting_minutes := v_total_waiting_minutes + greatest(
      0,
      round(extract(epoch FROM (now() - v_trip.waiting_start_time)) / 60)
    );
  END IF;

  PERFORM pg_catalog.set_config(
    'app.apply_trip_transition',
    pg_catalog.jsonb_build_object(
      'trip_id', p_trip_id,
      'actor_id', v_actor_id,
      'expected_status', v_trip.status,
      'new_status', p_new_status,
      'client_event_id', p_client_event_id
    )::text,
    true
  );

  UPDATE public.trips AS t
  SET
    status = p_new_status,
    updated_at = now(),
    waiting_start_time = CASE
      WHEN p_new_status = 'waiting' THEN now()
      ELSE t.waiting_start_time
    END,
    total_waiting_minutes = v_total_waiting_minutes,
    signature_captured_at = CASE
      WHEN p_new_status = 'completed' THEN now()
      ELSE t.signature_captured_at
    END,
    signature_data = CASE
      WHEN p_new_status = 'completed' AND NOT p_signature_declined THEN p_signature_data
      WHEN p_new_status = 'completed' THEN NULL
      ELSE t.signature_data
    END,
    signed_by_name = CASE
      WHEN p_new_status = 'completed' AND NOT p_signature_declined THEN p_signed_by_name
      WHEN p_new_status = 'completed' THEN NULL
      ELSE t.signed_by_name
    END,
    signature_declined = CASE
      WHEN p_new_status = 'completed' THEN p_signature_declined
      ELSE t.signature_declined
    END,
    signature_declined_reason = CASE
      WHEN p_new_status = 'completed' AND p_signature_declined THEN p_signature_declined_reason
      WHEN p_new_status = 'completed' THEN NULL
      ELSE t.signature_declined_reason
    END,
    cancel_reason = CASE
      WHEN p_new_status = ANY (ARRAY['cancelled'::text, 'no_show'::text]) THEN v_cancel_reason
      ELSE t.cancel_reason
    END,
    cancel_explanation = CASE
      WHEN p_new_status = ANY (ARRAY['cancelled'::text, 'no_show'::text]) THEN v_cancel_explanation
      ELSE t.cancel_explanation
    END
  WHERE t.id = p_trip_id
    AND t.org_id = p_org_id
  RETURNING t.* INTO v_trip;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Trip was not found or is not accessible';
  END IF;

  IF p_new_status = ANY (ARRAY['cancelled'::text, 'no_show'::text]) THEN
    INSERT INTO public.trip_cancellation_audits (
      trip_id,
      driver_id,
      org_id,
      reason,
      explanation,
      location_lat,
      location_lng,
      location_accuracy,
      location_timestamp,
      location_metadata,
      device_metadata,
      client_event_id
    )
    VALUES (
      p_trip_id,
      v_actor_id,
      p_org_id,
      v_cancel_reason,
      v_cancel_explanation,
      p_latitude,
      p_longitude,
      p_location_accuracy_m,
      p_location_captured_at,
      jsonb_strip_nulls(jsonb_build_object(
        'trigger_kind', p_trigger_kind,
        'source_surface', p_source_surface,
        'client_platform', p_client_platform,
        'location_source', p_location_source,
        'client_event_id', p_client_event_id
      )),
      jsonb_build_object('platform', p_client_platform),
      p_client_event_id
    )
    RETURNING id INTO v_cancellation_audit_id;
  END IF;

  INSERT INTO public.trip_status_history (
    trip_id,
    status,
    actor_id,
    actor_name,
    created_at,
    latitude,
    longitude,
    status_code,
    trigger_kind,
    source_surface,
    client_platform,
    client_event_id,
    location_source,
    location_captured_at,
    location_accuracy_m
  )
  VALUES (
    p_trip_id,
    v_status_label,
    v_actor_id,
    v_actor_name,
    now(),
    p_latitude,
    p_longitude,
    v_status_code,
    p_trigger_kind,
    p_source_surface,
    p_client_platform,
    p_client_event_id,
    p_location_source,
    p_location_captured_at,
    p_location_accuracy_m
  )
  RETURNING * INTO v_history;

  PERFORM pg_catalog.set_config('app.apply_trip_transition', '', true);

  RETURN jsonb_build_object(
    'trip_id', p_trip_id,
    'status', p_new_status,
    'history_id', v_history.id,
    'cancellation_audit_id', v_cancellation_audit_id,
    'event_created_at', v_history.created_at,
    'replayed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_trip_transition(
  uuid,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  timestamp with time zone,
  double precision,
  text,
  text,
  boolean,
  text,
  text,
  text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_trip_transition(
  uuid,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  timestamp with time zone,
  double precision,
  text,
  text,
  boolean,
  text,
  text,
  text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_trip_transition(
  uuid,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  timestamp with time zone,
  double precision,
  text,
  text,
  boolean,
  text,
  text,
  text
) TO authenticated;

COMMENT ON FUNCTION public.apply_trip_transition(
  uuid,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  text,
  double precision,
  double precision,
  text,
  timestamp with time zone,
  double precision,
  text,
  text,
  boolean,
  text,
  text,
  text
) IS
  'Atomically applies driver milestones and manager cancellations/completions with authenticated, idempotent audit events. Manual manager web completion records no location evidence.';
