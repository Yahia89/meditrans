export interface LiveDriver {
  id: string;
  full_name: string;
  current_lat?: number;
  current_lng?: number;
  last_location_update?: string;
  active: boolean; // if false, maybe offline
  status?: "en_route" | "idle" | "offline"; // derived status
  active_trip_id?: string;
  // Animation state
  lat: number;
  lng: number;
  target?: { lat: number; lng: number };
  bearing?: number;
}

export interface LiveTrip {
  id: string;
  status: "en_route" | "in_progress" | "scheduled" | "completed" | "cancelled";
  driver_id?: string;
  patient_id?: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_time?: string;
  /** Actual time the trip started (for elapsed time calculation) */
  actual_start_time?: string;
  /** Estimated arrival time */
  eta?: string;
  // Use "patients" object if joined, or define separate types
  patient?: {
    full_name: string;
  };
  driver?: {
    full_name: string;
  };
}

/**
 * State for route-following and trip summary tracking.
 * Tracks actual driven path for billing/summary purposes.
 */
export interface DriverRouteFollowingState {
  /** Current distance along route (meters from start) */
  distanceAlongRoute: number;
  /** Total distance of the route (meters) */
  totalDistance?: number;
  /** Segment index on the polyline */
  segmentIndex: number;
  /** Full actual GPS path history for the trip (for driven path display & billing) */
  actualPathHistory?: { lat: number; lng: number }[];
}
