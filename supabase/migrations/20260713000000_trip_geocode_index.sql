-- Migration: Add indexes on trip coordinate columns for map snippet queries
-- Date: 2026-07-13

-- Index for pickup coordinates (used by map snippet in trip summary PDF)
CREATE INDEX IF NOT EXISTS idx_trips_pickup_coords
  ON public.trips (pickup_lat, pickup_lng)
  WHERE pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL;

-- Index for dropoff coordinates
CREATE INDEX IF NOT EXISTS idx_trips_dropoff_coords
  ON public.trips (dropoff_lat, dropoff_lng)
  WHERE dropoff_lat IS NOT NULL AND dropoff_lng IS NOT NULL;
