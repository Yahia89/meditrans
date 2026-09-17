import { supabase } from "@/lib/supabase";
import {
  ALL_DRIVER_TRIP_DATES,
  getDriverTripDateBounds,
  validateDriverPrintTrips,
  type DriverPrintTrip,
  type DriverTripDateRange,
} from "@/utils/driver-trip-print";

const PAGE_SIZE = 500;
const TRIP_FIELDS = "id,org_id,driver_id,patient_id,pickup_time,pickup_location,dropoff_location,status,broker_trip_id,broker_reference_number,actual_distance_miles,distance_miles,patient:patients(id,org_id,full_name)";

/** Read only the authenticated user's visible trips, scoped to this driver and company. */
export async function fetchDriverPrintTrips({ orgId, driverId, range = ALL_DRIVER_TRIP_DATES, timezone }: {
  orgId: string; driverId: string; range?: DriverTripDateRange; timezone: string;
}): Promise<DriverPrintTrip[]> {
  if (!orgId || !driverId) throw new Error("A driver and company are required to load trip details.");
  const bounds = getDriverTripDateBounds(range, timezone);
  const records: DriverPrintTrip[] = [];
  let expectedCount: number | undefined;
  do {
    let query = supabase.from("trips").select(TRIP_FIELDS, { count: "exact" })
      .eq("org_id", orgId).eq("driver_id", driverId)
      .order("pickup_time", { ascending: false }).order("id")
      .range(records.length, records.length + PAGE_SIZE - 1);
    if (bounds.from) query = query.gte("pickup_time", bounds.from);
    if (bounds.before) query = query.lt("pickup_time", bounds.before);
    const { data, error, count } = await query;
    if (error) throw error;
    if (!data || count === null || !Number.isSafeInteger(count) || count < 0) {
      throw new Error("The driver's complete trip details could not be loaded. Please try again.");
    }
    if ((expectedCount !== undefined && count !== expectedCount) || (!data.length && records.length < count)) {
      throw new Error("The trip list changed while loading. Please try again.");
    }
    expectedCount = count;
    records.push(...(data as unknown as DriverPrintTrip[]));
    validateDriverPrintTrips({ id: driverId, org_id: orgId }, records);
    if (records.length > expectedCount) throw new Error("The trip list changed while loading. Please try again.");
  } while (records.length < expectedCount);
  return records;
}
