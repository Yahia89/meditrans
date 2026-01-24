export interface LiveDriver {
  id: string;
  full_name: string;
  current_lat?: number;
  current_lng?: number;
  last_location_update?: string;
  active: boolean; // if false, maybe offline
  status?: "en_route" | "idle" | "offline"; // derived status
  active_trip_id?: string;
}

export interface LiveTrip {
  id: string;
  status: "en_route" | "in_progress" | "scheduled" | "completed" | "cancelled";
  driver_id?: string;
  patient_id?: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_time?: string;
  // Use "patients" object if joined, or define separate types
  patient?: {
    full_name: string;
  };
  driver?: {
    full_name: string;
  };
}
