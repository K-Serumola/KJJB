import { supabase } from '../lib/supabase';
import { Journey, RideRequest } from '../types';

export async function submitRequest(
    passengerId: string,
    journey: Journey,
    requestedTime: string,
    seatsNeeded = 1
): Promise<RideRequest> {
    const { data, error } = await supabase
        .from('ride_requests')
        .insert({ passenger_id: passengerId, ...journey, requested_time: requestedTime, seats_needed: seatsNeeded })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function chooseRide(requestId: string, rideId: string) {
    const { error } = await supabase
        .from('ride_requests').update({ ride_id: rideId }).eq('id', requestId);
    if (error) throw error;
}

async function setStatus(requestId: string, status: RideRequest['status']) {
    const { error } = await supabase
        .from('ride_requests').update({ status }).eq('id', requestId);
    if (error) throw error;
}

export const acceptRequest = (id: string) => setStatus(id, 'accepted');
export const declineRequest = (id: string) => setStatus(id, 'declined');
export const cancelRequest = (id: string) => setStatus(id, 'cancelled');

export async function getRequestsForRide(rideId: string): Promise<RideRequest[]> {
    const { data, error } = await supabase
        .from('ride_requests').select('*').eq('ride_id', rideId);
    if (error) throw error;
    return data;
}

export async function getRequestHistory(userId: string): Promise<RideRequest[]> {
    const { data, error } = await supabase
        .from('ride_requests').select('*').eq('passenger_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}