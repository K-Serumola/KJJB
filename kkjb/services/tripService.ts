import { supabase } from '../lib/supabase';

// The two steps of a trip, after the driver has accepted a request:
//   1. markPickedUp  - the driver typed the right PIN, the passenger is on board
//   2. completeTrip  - the driver ends the trip

// Each update only touches a request in the expected state, and checks that a
// row really changed (a tap on an old card can't skip a step).

export async function markPickedUp(requestId: string): Promise<void> {
    const { data, error } = await supabase
        .from('ride_requests')
        .update({ picked_up_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('status', 'accepted')
        .is('picked_up_at', null)
        .select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('This trip has already started or was changed.');
}

export async function completeTrip(requestId: string): Promise<void> {
    const { data, error } = await supabase
        .from('ride_requests')
        .update({ status: 'completed' })
        .eq('id', requestId)
        .eq('status', 'accepted')
        .not('picked_up_at', 'is', null)
        .select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('This trip cannot be completed yet.');
}
