export type TripStatus =
  | "pending"
  | "assigned"
  | "accepted"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
  | "waiting";

export interface Trip {
  id: string;
  org_id: string;
  patient_id: string;
  driver_id: string | null;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  trip_type: string;
  status: TripStatus;
  notes: string | null;
  distance_miles?: number | null;
  duration_minutes?: number | null;
  created_at: string;
  updated_at?: string;
  status_requested?: TripStatus | null;
  status_requested_at?: string | null;
  cancel_reason?: string | null;
  cancel_explanation?: string | null;
  // Signature capture fields
  signature_data?: string | null;
  signature_captured_at?: string | null;
  signed_by_name?: string | null;
  signature_declined?: boolean;
  signature_declined_reason?: string | null;
  // Actual trip metrics (captured during/after trip)
  actual_distance_miles?: number | null;
  actual_duration_minutes?: number | null;
  total_waiting_minutes?: number | null;
  waiting_start_time?: string | null;
  eta_sms_sent_at?: string | null;
  requester_first_name?: string | null;
  requester_last_name?: string | null;
  requester_title?: string | null;
  entry_date?: string | null;
  billing_details?: {
    base_fee: number;
    mileage_rate: number;
    mileage_cost: number;
    deadhead_rate: number;
    deadhead_cost: number;
    wait_time_cost: number;
    total_cost: number;
    service_type: string;
  } | null;
  patient?: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    created_at: string;
    user_id: string | null;
  };
  driver?: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    user_id: string | null;
    vehicle_info: string | null;
  };
}

export interface TripStatusHistory {
  id: string;
  trip_id: string;
  status: string;
  actor_id: string | null;
  actor_name: string;
  created_at: string;
}
