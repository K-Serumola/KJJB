import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
    const [session, setSession] = useState<Session | null>(null);
    const [ready, setReady] = useState(false);
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setReady(true);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
        return () => sub.subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!ready) return;
        const inAuth = segments[0] === '(auth)';
        if (!session && !inAuth) router.replace('/(auth)/login');
        else if (session && inAuth) router.replace('/(tabs)');
    }, [session, ready, segments]);

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
        </Stack>
    );
}