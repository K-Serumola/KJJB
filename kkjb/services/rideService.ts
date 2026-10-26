import { supabase } from '../lib/supabase';
import { Journey, Ride } from '../types';

type RouteDetails = Pick<Ride, 'route_polyline' | 'route_distance_m' | 'est_duration_s'>;

export async function postRide(
    driverId: string,
    journey: Journey,
    seats: number,
    departureTime: string,
    route?: RouteDetails,
): Promise<Ride> {
    const { data, error } = await supabase
        .from('rides')
        .insert({ driver_id: driverId, ...journey, seats_available: seats, departure_time: departureTime, ...route })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function getRide(rideId: string): Promise<Ride> {
    const { data, error } = await supabase
        .from('rides').select('*').eq('id', rideId).single();
    if (error) throw error;
    return data;
}

export async function takeSeats(rideId: string, n: number) {
    const ride = await getRide(rideId);
    if (ride.seats_available < n) throw new Error('Not enough seats left');
    const left = ride.seats_available - n;
    // Only update if the seat count is still what we just read. If two people
    // take a seat at the same moment, the second update matches nothing.
    const { data, error } = await supabase
        .from('rides')
        .update({ seats_available: left, status: left === 0 ? 'full' : ride.status })
        .eq('id', rideId)
        .eq('seats_available', ride.seats_available)
        .select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('The seats just changed. Please try again.');
}

async function setStatus(rideId: string, status: Ride['status']) {
    const { error } = await supabase.from('rides').update({ status }).eq('id', rideId);
    if (error) throw error;
}

export const completeRide = (rideId: string) => setStatus(rideId, 'completed');

// The driver's ride that is still open (waiting to leave, or on the road).
// A driver can only have one of these at a time.
export async function getMyActiveRide(driverId: string): Promise<Ride | null> {
    const { data, error } = await supabase
        .from('rides').select('*')
        .eq('driver_id', driverId)
        .in('status', ['active', 'full'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data;
}

// Cancels the ride AND every pending/accepted request on it (done in the
// database by the cancel_ride function, so passengers see it too).
export async function cancelRide(rideId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_ride', { p_ride_id: rideId });
    if (error) throw error;
}

// Ends the ride: picked-up passengers become Completed, everyone else is cancelled.
export async function finishRide(rideId: string): Promise<void> {
    const { error } = await supabase.rpc('finish_ride', { p_ride_id: rideId });
    if (error) throw error;
}

export async function searchRides(filters: Partial<Ride> = {}): Promise<Ride[]> {
    const { data, error } = await supabase
        .from('rides').select('*')
        .eq('status', 'active').gt('seats_available', 0)
        .gte('departure_time', new Date().toISOString())   // hides rides that already left
        .match(filters);
    if (error) throw error;
    return data;
}

export async function getRideHistory(userId: string): Promise<Ride[]> {
    const { data, error } = await supabase
        .from('rides').select('*').eq('driver_id', userId)
        .order('departure_time', { ascending: false });
    if (error) throw error;
    return data;
}
