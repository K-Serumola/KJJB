import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { MOCK_USER } from './mockData';


export interface AppUser {
    id: string;
    fullName: string;
    email: string;
    initials: string;
    role: 'driver' | 'passenger';
    // These two aren't in the database yet, so they stay placeholders (walletBalance is no longer shown)
    rating: number;
    walletBalance: number;
}

interface ProfileRow {
    full_name: string | null;
    role: 'driver' | 'passenger';
}

const UserContext = createContext<{ user: AppUser | null; refreshProfile: () => Promise<void> }>({
    user: null,
    refreshProfile: async () => {},
});

function getInitials(name: string) {
    const letters = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
    return letters || '?';
}

export function UserProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<ProfileRow | null>(null);

    // 1. Track who is logged in
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
        return () => sub.subscription.unsubscribe();
    }, []);

    // 2. Load the logged-in person's profiles row (and let screens reload it)
    const userId = session?.user.id;
    const loadProfile = useCallback(async () => {
        if (!userId) {
            setProfile(null);
            return;
        }
        const { data } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', userId)
            .maybeSingle();
        setProfile(data as ProfileRow | null);
    }, [userId]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const user = useMemo<AppUser | null>(() => {
        if (!session) return null;
        const email = session.user.email ?? '';
        // Fallbacks: profile name -> signup name -> start of the email
        const fullName =
            profile?.full_name || session.user.user_metadata?.full_name || email.split('@')[0];
        return {
            id: session.user.id,
            fullName,
            email,
            initials: getInitials(fullName),
            role: profile?.role ?? 'passenger',
            rating: MOCK_USER.rating,
            walletBalance: MOCK_USER.walletBalance,
        };
    }, [session, profile]);

    return <UserContext.Provider value={{ user, refreshProfile: loadProfile }}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);