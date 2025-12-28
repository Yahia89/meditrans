export type TripStatus = 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

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
    created_at: string;
    status_requested?: TripStatus | null;
    status_requested_at?: string | null;
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
