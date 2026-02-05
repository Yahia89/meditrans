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
 * State for route-aware animation and deviation detection
 * Used internally by useLiveTracking
 */
export interface DriverRouteFollowingState {
  /** Current distance along route (meters from start) */
  distanceAlongRoute: number;
  /** Total distance of the route (meters) */
  totalDistance?: number;
  /** Segment index on the polyline */
  segmentIndex: number;
  /** Is driver off the designated route? */
  isOffRoute: boolean;
  /** When driver first went off-route (ms timestamp) */
  offRouteStartTime: number | null;
  /** Has a reroute been requested/flagged? */
  rerouteRequested: boolean;
  /** Current GPS trail when actively off-route (orange live) */
  deviationTrail?: { lat: number; lng: number }[];
  /** Completed deviation segments from past off-route periods (orange history) */
  completedDeviations?: { lat: number; lng: number }[][];
  /** Full actual GPS path history for the trip (for gray driven path) */
  actualPathHistory?: { lat: number; lng: number }[];
}
