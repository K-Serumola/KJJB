import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getProfile, switchRole, updateDetails } from '../../services/profileService';
import { getRideHistory, cancelRide, completeRide } from '../../services/rideService';
import { getRequestHistory } from '../../services/requestService';
import { Profile as ProfileType, Ride, RideRequest } from '../../types';

export default function Profile() {
    const [profile, setProfile] = useState<ProfileType | null>(null);
    const [name, setName] = useState('');
    const [rides, setRides] = useState<Ride[]>([]);
    const [requests, setRequests] = useState<RideRequest[]>([]);

    const load = useCallback(async () => {
        try {
            const { data } = await supabase.auth.getSession();
            const userId = data.session?.user.id;
            if (!userId) return;
            const p = await getProfile(userId);
            setProfile(p);
            setName(p.full_name ?? '');
            if (p.role === 'driver') {
                setRides(await getRideHistory(userId));
                setRequests([]);
            } else {
                setRequests(await getRequestHistory(userId));
                setRides([]);
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function run(action: () => Promise<void>, message?: string) {
        try {
            await action();
            if (message) Alert.alert(message);
            load();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    }

    if (!profile) return <View style={styles.center}><Text>Loading...</Text></View>;

    const isDriver = profile.role === 'driver';

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Profile</Text>
            <Text>Current role: {profile.role}</Text>

            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />
            <Pressable style={styles.button} onPress={() => run(() => updateDetails(profile.id, name), 'Saved')}>
                <Text style={styles.buttonText}>Save details</Text>
            </Pressable>
            <Pressable style={styles.buttonAlt} onPress={() => run(() => switchRole(profile.id))}>
                <Text style={styles.buttonText}>Switch to {isDriver ? 'passenger' : 'driver'}</Text>
            </Pressable>

            <Text style={styles.heading}>{isDriver ? 'My rides' : 'My requests'}</Text>

            {isDriver && rides.length === 0 && <Text style={styles.empty}>No rides yet.</Text>}
            {isDriver && rides.map((r) => (
                <View key={r.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{new Date(r.departure_time).toLocaleString()}</Text>
                    <Text>{r.seats_available} seat(s) left · {r.status}</Text>
                    {(r.status === 'active' || r.status === 'full') && (
                        <View style={styles.row}>
                            <Pressable style={styles.accept} onPress={() => run(() => completeRide(r.id))}>
                                <Text style={styles.buttonText}>Complete</Text>
                            </Pressable>
                            <Pressable style={styles.decline} onPress={() => run(() => cancelRide(r.id))}>
                                <Text style={styles.buttonText}>Cancel</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            ))}

            {!isDriver && requests.length === 0 && <Text style={styles.empty}>No requests yet.</Text>}
            {!isDriver && requests.map((q) => (
                <View key={q.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{new Date(q.requested_time).toLocaleString()}</Text>
                    <Text>{q.seats_needed} seat(s) · {q.status}</Text>
                </View>
            ))}

            <Pressable onPress={() => supabase.auth.signOut()}>
                <Text style={styles.logout}>Log out</Text>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 24, paddingTop: 60, gap: 10 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    heading: { fontSize: 18, fontWeight: '600', marginTop: 16 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
    button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' },
    buttonAlt: { backgroundColor: '#0d9488', padding: 14, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: 'white', fontWeight: '600' },
    empty: { color: '#777' },
    card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, gap: 4 },
    cardTitle: { fontWeight: '600' },
    row: { flexDirection: 'row', gap: 8, marginTop: 8 },
    accept: { flex: 1, backgroundColor: '#0d9488', padding: 10, borderRadius: 8, alignItems: 'center' },
    decline: { flex: 1, backgroundColor: '#dc2626', padding: 10, borderRadius: 8, alignItems: 'center' },
    logout: { color: 'red', textAlign: 'center', marginTop: 16 },
});