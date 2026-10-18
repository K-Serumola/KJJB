import { supabase } from '../lib/supabase';
import { Journey, Ride } from '../types';

export async function postRide(
    driverId: string,
    journey: Journey,
    seats: number,
    departureTime: string
): Promise<Ride> {
    const { data, error } = await supabase
        .from('rides')
        .insert({ driver_id: driverId, ...journey, seats_available: seats, departure_time: departureTime })
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function setStatus(rideId: string, status: Ride['status']) {
    const { error } = await supabase.from('rides').update({ status }).eq('id', rideId);
    if (error) throw error;
}

export const cancelRide = (rideId: string) => setStatus(rideId, 'cancelled');
export const completeRide = (rideId: string) => setStatus(rideId, 'completed');

export async function searchRides(filters: Partial<Ride> = {}): Promise<Ride[]> {
    const { data, error } = await supabase
        .from('rides').select('*')
        .eq('status', 'active').gt('seats_available', 0)
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