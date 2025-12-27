export type TripStatus = 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export interface Trip {
    id: string;
    org_id: string;
    patient_id: string;
    driver_id?: string | null;
    pickup_location: string;
    dropoff_location: string;
    pickup_time: string;
    status: TripStatus;
    trip_type: string;
    notes?: string | null;
    created_at: string;
    updated_at: string;
    patient?: {
        id: string;
        full_name: string;
        phone: string;
        email: string;
        user_id?: string | null;
        created_at: string;
    };
    driver?: {
        id: string;
        full_name: string;
        phone: string;
        email: string;
        user_id?: string | null;
        vehicle_info?: string | null;
    };
}
