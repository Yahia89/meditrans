-- Migration: Support for SMS Notifications and Driver Tracking
-- Date: 2026-01-08

-- 1. Organizations: Add SMS toggle
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT TRUE;

-- 2. Patients: Add SMS opt-out
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN DEFAULT FALSE;

-- 3. Drivers: Add current location
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP WITH TIME ZONE;

-- 4. Trips: Add actual metrics
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS actual_distance_miles NUMERIC;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS actual_duration_minutes NUMERIC;
-- To track if we already sent the 5-min warning
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS eta_sms_sent_at TIMESTAMP WITH TIME ZONE;

-- 5. SMS Logs table
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id),
    trip_id UUID REFERENCES public.trips(id),
    patient_id UUID REFERENCES public.patients(id),
    phone_number TEXT NOT NULL,
    message_type TEXT NOT NULL, -- 'ETA_WARNING', 'Driver_Arrival', etc.
    status TEXT NOT NULL, -- 'queued', 'sent', 'failed'
    provider_id TEXT, -- Telnyx message ID
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    error_message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sms_logs_trip_id ON public.sms_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_drivers_location ON public.drivers(current_lat, current_lng);

-- RLS Policies
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sms logs for their org" ON public.sms_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organization_memberships om
            WHERE om.org_id = sms_logs.org_id
            AND om.user_id = auth.uid()
        )
    );
