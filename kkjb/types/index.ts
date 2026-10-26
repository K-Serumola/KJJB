export type Role = 'driver' | 'passenger';

export interface Profile {
    id: string;
    full_name: string | null;
    role: Role;
    created_at: string;
}

export interface Journey {
    origin_lat: number;
    origin_lng: number;
    destination_lat: number;
    destination_lng: number;
}

export interface Ride extends Journey {
    id: string;
    driver_id: string;
    seats_available: number;
    departure_time: string;
    status: 'active' | 'full' | 'cancelled' | 'completed';
    route_polyline: string | null;
    route_distance_m: number | null;
    est_duration_s: number | null;
    created_at: string;
}

export interface RideRequest extends Journey {
    id: string;
    passenger_id: string;
    ride_id: string | null;
    status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';
    seats_needed: number;
    requested_time: string;
    created_at: string;
    fare_offer?: number | null;   // price the passenger offered, in Pula
    pin?: string | null;          // 4-digit code the passenger tells the driver on boarding
    picked_up_at?: string | null; // set when the driver has verified the PIN
    cancelled_by?: 'driver' | 'passenger' | null; // who cancelled it, if it was cancelled
    cancel_reason?: string | null; // why the passenger cancelled (shown to the driver)
}

export interface MatchResult {
    id: string;
    request_id: string;
    ride_id: string;
    pickup_distance_m: number | null;
    detour_m: number | null;
    time_diff_min: number | null;
    score: number | null;
    created_at: string;
}

export type RequestWithPassenger = RideRequest & {
    profiles?: { full_name: string | null } | null;
};

export interface RideMatch {
    ride: Ride;
    pickup_distance_m: number;
    detour_m: number;
    time_diff_min: number;
    score: number;
}
