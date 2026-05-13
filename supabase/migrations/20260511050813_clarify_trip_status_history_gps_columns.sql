-- Migration: clarify_trip_status_history_gps_columns
--
-- CONTEXT:
-- The trip_status_history table already has latitude/longitude columns (added in a
-- previous migration as part of the GPS tracking feature). This migration is a no-op
-- schema change but documents a critical bug fix made to the TypeScript layer:
--
-- BUG FIXED: The TripStatusHistory TypeScript type used `lat`/`lng` field names but
-- the actual DB columns are `latitude`/`longitude`. This caused the PDF generator to
-- always show "N/A" for coordinates in the Trip Milestone Metrics table, even when GPS
-- data was successfully stored in the database.
--
-- Files fixed:
--   - src/components/trips/types.ts: TripStatusHistory.lat -> latitude, lng -> longitude
--   - src/utils/pdf-generator.ts: m.lat/m.lng -> m.latitude/m.longitude
--                                  item.lat/item.lng -> item.latitude/item.longitude
--
-- BACKEND STATUS: No schema changes needed. The mobile app is correctly pushing GPS
-- coordinates to the latitude/longitude columns. The fix is purely in the web layer.
--
-- Example: Trip 8c77027c-d63e-4631-bb3f-c92feea735a1 shows N/A because it was created
-- before the mobile GPS feature was implemented, so latitude/longitude are genuinely null.
-- New trips (e.g. 874e54ea-bc5c-4275-ae1f-1f7eb94beac7) correctly have GPS data.

-- Ensure comments on the columns are up to date for developer clarity
COMMENT ON COLUMN public.trip_status_history.latitude IS
  'GPS latitude of driver at time of status change. Captured by mobile app. Used by web PDF generator for Trip Milestone Metrics table.';

COMMENT ON COLUMN public.trip_status_history.longitude IS
  'GPS longitude of driver at time of status change. Captured by mobile app. Used by web PDF generator for Trip Milestone Metrics table.';
