import { supabase } from '../lib/supabase';
import { Profile, Role } from '../types';

export async function getProfile(profileId: string): Promise<Profile> {
    const { data, error } = await supabase
        .from('profiles').select('*').eq('id', profileId).single();
    if (error) throw error;
    return data;
}

export async function switchRole(profileId: string) {
    const profile = await getProfile(profileId);
    const role: Role = profile.role === 'driver' ? 'passenger' : 'driver';
    const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);
    if (error) throw error;
}

export async function updateDetails(profileId: string, fullName: string) {
    const { error } = await supabase
        .from('profiles').update({ full_name: fullName }).eq('id', profileId);
    if (error) throw error;
}