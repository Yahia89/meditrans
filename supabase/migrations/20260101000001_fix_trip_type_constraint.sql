-- Fix trip_type constraint to allow all values including custom ones from "Other"
-- The previous constraint was too strict and caused errors when saving trips.

ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_trip_type_check;

-- Optional: If we wanted to enforce the list but allow 'OTHER', we would do that.
-- But the frontend sends the custom text as the value, so we must allow any text.
