import { supabase } from '../lib/supabase';

// Closes a passenger's SEARCH (a request that was never sent to a driver) so it
// doesn't stay "pending" forever.
//
// It only touches a row that is still 'pending', so it can't cancel a request
// that a driver has already accepted. To cancel a request that WAS sent to a
// driver, use cancelRequest in requestService.ts (it also gives the seat back).
export async function cancelRequest(requestId: string): Promise<void> {
    const { error } = await supabase
        .from('ride_requests')
        .update({ status: 'cancelled', cancelled_by: 'passenger' })
        .eq('id', requestId)
        .eq('status', 'pending');
    if (error) throw error;
}
