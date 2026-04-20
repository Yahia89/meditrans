// Shared types for the Summary module

export interface SummaryTrip {
  id: string;
  trip_type: string;
  pickup_time: string;
  pickup_location: string;
  dropoff_location: string;
  status: string;
  duration_minutes: number | null;
  actual_duration_minutes: number | null;
  distance_miles: number | null;
  actual_distance_miles: number | null;
  billing_details: { total_cost: number } | null;
  patient: {
    full_name: string;
    vehicle_type_need: string | null;
    waiver_type: string | null;
    referral_by: string | null;
    sal_status: string | null;
    referral_date: string | null;
    referral_expiration_date: string | null;
  } | null;
  driver: {
    full_name: string;
    vehicle_info: string | null;
  } | null;
}

export interface FilterState {
  startDate: string;
  endDate: string;
  selectedVehicleTypes: string[];
  selectedWaiverTypes: string[];
  selectedReferredBy: string[];
  selectedSalStatuses: string[];
  selectedTripPurposes: string[];
  selectedTripStatuses: string[];
}

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

export interface MultiSelectOption {
  value: string;
  label: string;
  color?: string;
}
