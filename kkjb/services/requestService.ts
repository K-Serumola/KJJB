import { supabase } from '../lib/supabase';
import { Journey, RequestWithPassenger, RideMatch, RideRequest } from '../types';

export async function submitRequest(
    passengerId: string,
    journey: Journey,
    requestedTime: string,
    seatsNeeded = 1,
    fareOffer?: number // price the passenger offered, in Pula
): Promise<RideRequest> {
    const { data, error } = await supabase
        .from('ride_requests')
        .insert({
            passenger_id: passengerId,
            ...journey,
            requested_time: requestedTime,
            seats_needed: seatsNeeded,
            fare_offer: fareOffer ?? null,
        })
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

// The driver says no. Only works while the request is still pending, so it can
// never bring back a request the passenger already cancelled.
export async function declineRequest(id: string): Promise<void> {
    const { data, error } = await supabase
        .from('ride_requests')
        .update({ status: 'declined' })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('This request is no longer pending.');
}

// The driver says yes. Done in the database (accept_request function) in ONE
// step: checks the request is still pending, takes the seat, marks it accepted.
export async function approveRequest(id: string): Promise<void> {
    const { error } = await supabase.rpc('accept_request', { p_request_id: id });
    if (error) throw error;
}

// The request this passenger has already SENT to a driver and that is not over yet
// (waiting for an answer, accepted, or the trip is on the road). While one exists
// the passenger cannot request another driver.
export async function getMyOpenRequest(passengerId: string): Promise<RideRequest | null> {
    const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('passenger_id', passengerId)
        .not('ride_id', 'is', null)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data;
}
// The passenger cancels. Done in the database (cancel_request function) so an
// accepted seat is given back to the ride and the driver is told.
export async function cancelRequest(id: string, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_request', { p_request_id: id, p_reason: reason ?? null });
    if (error) throw error;
}

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
export async function getRequestsForDriver(driverId: string): Promise<RequestWithPassenger[]> {
    const { data, error } = await supabase
        .from('ride_requests')
        .select('*, rides!inner(driver_id), profiles(full_name)')
        .eq('rides.driver_id', driverId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data as RequestWithPassenger[];
}

export async function findMatches(requestId: string): Promise<RideMatch[]> {
    const { data, error } = await supabase.functions.invoke('find-matches', {
        body: { request_id: requestId },
    });
    if (error) {
        let msg = error.message;
        try {
            msg = (await (error as any).context.json()).error ?? msg;
        } catch {}
        throw new Error(msg);
    }
    return data.matches;
}