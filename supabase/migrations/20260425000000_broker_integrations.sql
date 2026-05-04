-- Broker integrations for org-scoped trip drops.
-- Secrets are intentionally stored in a separate table with no authenticated
-- read policy so browser clients can only load safe connection metadata.

CREATE TABLE IF NOT EXISTS public.broker_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    broker_type text NOT NULL,
    name text NOT NULL,
    environment text NOT NULL DEFAULT 'sandbox'
        CHECK (environment IN ('sandbox', 'production')),
    status text NOT NULL DEFAULT 'not_connected'
        CHECK (status IN ('not_connected', 'testing', 'connected', 'failed', 'syncing')),
    public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    sync_window_days_back integer NOT NULL DEFAULT 0
        CHECK (sync_window_days_back BETWEEN 0 AND 30),
    sync_window_days_ahead integer NOT NULL DEFAULT 14
        CHECK (sync_window_days_ahead BETWEEN 0 AND 365),
    auto_sync_enabled boolean NOT NULL DEFAULT false,
    webhook_enabled boolean NOT NULL DEFAULT false,
    last_tested_at timestamp with time zone,
    last_synced_at timestamp with time zone,
    last_sync_status text,
    last_error text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT broker_connections_type_check
        CHECK (broker_type IN ('mtm_link')),
    CONSTRAINT broker_connections_unique_name
        UNIQUE (org_id, broker_type, name)
);

CREATE TABLE IF NOT EXISTS public.broker_connection_secrets (
    broker_connection_id uuid PRIMARY KEY REFERENCES public.broker_connections(id) ON DELETE CASCADE,
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    encrypted_credentials text NOT NULL,
    credential_fingerprint text,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.broker_sync_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
    run_type text NOT NULL DEFAULT 'manual'
        CHECK (run_type IN ('manual', 'scheduled', 'webhook')),
    status text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
    window_start timestamp with time zone,
    window_end timestamp with time zone,
    requested_by uuid REFERENCES auth.users(id),
    fetched_count integer NOT NULL DEFAULT 0,
    imported_count integer NOT NULL DEFAULT 0,
    updated_count integer NOT NULL DEFAULT 0,
    skipped_count integer NOT NULL DEFAULT 0,
    failed_count integer NOT NULL DEFAULT 0,
    error_message text,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.broker_trip_imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
    broker_sync_run_id uuid REFERENCES public.broker_sync_runs(id) ON DELETE SET NULL,
    trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
    broker_name text NOT NULL,
    broker_trip_id text,
    broker_reference_number text,
    operation text NOT NULL
        CHECK (operation IN ('imported', 'updated', 'skipped', 'failed')),
    external_status text,
    raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.broker_trip_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    broker_connection_id uuid NOT NULL REFERENCES public.broker_connections(id) ON DELETE CASCADE,
    trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    broker_name text NOT NULL,
    broker_trip_id text NOT NULL,
    broker_reference_number text,
    external_status text,
    external_payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
    last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
    last_synced_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT broker_trip_links_trip_unique UNIQUE (trip_id),
    CONSTRAINT broker_trip_links_broker_unique
        UNIQUE (org_id, broker_connection_id, broker_trip_id)
);

CREATE TABLE IF NOT EXISTS public.broker_event_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    broker_connection_id uuid REFERENCES public.broker_connections(id) ON DELETE CASCADE,
    broker_name text NOT NULL,
    broker_trip_id text,
    direction text NOT NULL DEFAULT 'inbound'
        CHECK (direction IN ('inbound', 'outbound')),
    event_type text NOT NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
    idempotency_key text,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    attempts integer NOT NULL DEFAULT 0,
    next_attempt_at timestamp with time zone,
    locked_at timestamp with time zone,
    processed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trips
    ADD COLUMN IF NOT EXISTS broker_name text,
    ADD COLUMN IF NOT EXISTS broker_trip_id text,
    ADD COLUMN IF NOT EXISTS broker_reference_number text,
    ADD COLUMN IF NOT EXISTS broker_connection_id uuid REFERENCES public.broker_connections(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS external_status text,
    ADD COLUMN IF NOT EXISTS external_payload_snapshot jsonb,
    ADD COLUMN IF NOT EXISTS synced_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_broker_connections_org_status
    ON public.broker_connections (org_id, status);
CREATE INDEX IF NOT EXISTS idx_broker_connections_org_type
    ON public.broker_connections (org_id, broker_type);
CREATE INDEX IF NOT EXISTS idx_broker_sync_runs_connection_started
    ON public.broker_sync_runs (broker_connection_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_sync_runs_org_started
    ON public.broker_sync_runs (org_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_trip_imports_connection_created
    ON public.broker_trip_imports (broker_connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_trip_imports_org_operation
    ON public.broker_trip_imports (org_id, operation, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_trip_links_org_connection
    ON public.broker_trip_links (org_id, broker_connection_id);
CREATE INDEX IF NOT EXISTS idx_broker_event_queue_pending
    ON public.broker_event_queue (status, next_attempt_at, created_at)
    WHERE status IN ('pending', 'failed');
CREATE UNIQUE INDEX IF NOT EXISTS idx_broker_event_queue_idempotency
    ON public.broker_event_queue (org_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_broker_external_unique
    ON public.trips (org_id, broker_connection_id, broker_trip_id)
    WHERE broker_connection_id IS NOT NULL AND broker_trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trips_broker_connection
    ON public.trips (broker_connection_id)
    WHERE broker_connection_id IS NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'set_updated_at'
          AND pronamespace = 'public'::regnamespace
    ) THEN
        DROP TRIGGER IF EXISTS broker_connections_set_updated_at ON public.broker_connections;
        CREATE TRIGGER broker_connections_set_updated_at
            BEFORE UPDATE ON public.broker_connections
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

ALTER TABLE public.broker_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_trip_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_trip_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_event_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view broker connections in their org"
    ON public.broker_connections
    FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) IS NOT NULL
        AND (
            EXISTS (
                SELECT 1
                FROM public.organization_memberships m
                WHERE m.org_id = broker_connections.org_id
                  AND m.user_id = (SELECT auth.uid())
                  AND m.role::text IN ('owner', 'admin')
            )
            OR EXISTS (
                SELECT 1
                FROM public.user_profiles p
                WHERE p.user_id = (SELECT auth.uid())
                  AND p.is_super_admin = true
            )
        )
    );

CREATE POLICY "Service role can manage broker connections"
    ON public.broker_connections
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can manage broker connection secrets"
    ON public.broker_connection_secrets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admins can view broker sync runs in their org"
    ON public.broker_sync_runs
    FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) IS NOT NULL
        AND (
            EXISTS (
                SELECT 1
                FROM public.organization_memberships m
                WHERE m.org_id = broker_sync_runs.org_id
                  AND m.user_id = (SELECT auth.uid())
                  AND m.role::text IN ('owner', 'admin')
            )
            OR EXISTS (
                SELECT 1
                FROM public.user_profiles p
                WHERE p.user_id = (SELECT auth.uid())
                  AND p.is_super_admin = true
            )
        )
    );

CREATE POLICY "Service role can manage broker sync runs"
    ON public.broker_sync_runs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admins can view broker trip imports in their org"
    ON public.broker_trip_imports
    FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) IS NOT NULL
        AND (
            EXISTS (
                SELECT 1
                FROM public.organization_memberships m
                WHERE m.org_id = broker_trip_imports.org_id
                  AND m.user_id = (SELECT auth.uid())
                  AND m.role::text IN ('owner', 'admin')
            )
            OR EXISTS (
                SELECT 1
                FROM public.user_profiles p
                WHERE p.user_id = (SELECT auth.uid())
                  AND p.is_super_admin = true
            )
        )
    );

CREATE POLICY "Service role can manage broker trip imports"
    ON public.broker_trip_imports
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admins can view broker trip links in their org"
    ON public.broker_trip_links
    FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) IS NOT NULL
        AND (
            EXISTS (
                SELECT 1
                FROM public.organization_memberships m
                WHERE m.org_id = broker_trip_links.org_id
                  AND m.user_id = (SELECT auth.uid())
                  AND m.role::text IN ('owner', 'admin')
            )
            OR EXISTS (
                SELECT 1
                FROM public.user_profiles p
                WHERE p.user_id = (SELECT auth.uid())
                  AND p.is_super_admin = true
            )
        )
    );

CREATE POLICY "Service role can manage broker trip links"
    ON public.broker_trip_links
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admins can view broker events in their org"
    ON public.broker_event_queue
    FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.uid()) IS NOT NULL
        AND (
            EXISTS (
                SELECT 1
                FROM public.organization_memberships m
                WHERE m.org_id = broker_event_queue.org_id
                  AND m.user_id = (SELECT auth.uid())
                  AND m.role::text IN ('owner', 'admin')
            )
            OR EXISTS (
                SELECT 1
                FROM public.user_profiles p
                WHERE p.user_id = (SELECT auth.uid())
                  AND p.is_super_admin = true
            )
        )
    );

CREATE POLICY "Service role can manage broker events"
    ON public.broker_event_queue
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

GRANT SELECT ON public.broker_connections TO authenticated;
GRANT SELECT ON public.broker_sync_runs TO authenticated;
GRANT SELECT ON public.broker_trip_imports TO authenticated;
GRANT SELECT ON public.broker_trip_links TO authenticated;
GRANT SELECT ON public.broker_event_queue TO authenticated;

GRANT ALL ON public.broker_connections TO service_role;
GRANT ALL ON public.broker_connection_secrets TO service_role;
GRANT ALL ON public.broker_sync_runs TO service_role;
GRANT ALL ON public.broker_trip_imports TO service_role;
GRANT ALL ON public.broker_trip_links TO service_role;
GRANT ALL ON public.broker_event_queue TO service_role;

COMMENT ON TABLE public.broker_connections IS 'Safe org-scoped broker connection metadata for provider admins.';
COMMENT ON TABLE public.broker_connection_secrets IS 'Encrypted broker credentials. No browser-facing SELECT policy is defined.';
COMMENT ON TABLE public.broker_sync_runs IS 'Manual, scheduled, and webhook-triggered broker sync execution logs.';
COMMENT ON TABLE public.broker_trip_imports IS 'Per-trip broker import audit rows with raw and normalized payload snapshots.';
COMMENT ON TABLE public.broker_trip_links IS 'Stable external broker trip identity links used to prevent duplicate imports.';
COMMENT ON TABLE public.broker_event_queue IS 'Inbound and outbound broker event queue for webhooks and future status pushes.';
