import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getProfile } from '../../services/profileService';
import {
    getRequestsForDriver,
    getRequestHistory,
    acceptRequest,
    declineRequest,
    cancelRequest,
} from '../../services/requestService';
import { takeSeats } from '../../services/rideService';
import { RequestWithPassenger, Role } from '../../types';

export default function Requests() {
    const [role, setRole] = useState<Role | null>(null);
    const [requests, setRequests] = useState<RequestWithPassenger[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        setRefreshing(true);
        try {
            const { data } = await supabase.auth.getSession();
            const userId = data.session?.user.id;
            if (!userId) return;
            const profile = await getProfile(userId);
            setRole(profile.role);
            setRequests(
                profile.role === 'driver'
                    ? await getRequestsForDriver(userId)
                    : await getRequestHistory(userId)
            );
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function run(action: () => Promise<void>) {
        try {
            await action();
            load();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    }

    const accept = (req: RequestWithPassenger) =>
        run(async () => {
            if (!req.ride_id) throw new Error('This request has no ride');
            await takeSeats(req.ride_id, req.seats_needed);
            await acceptRequest(req.id);
        });

    if (role === null) return <View style={styles.container}><Text>Loading...</Text></View>;

    const isDriver = role === 'driver';

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{isDriver ? 'Incoming Requests' : 'My Requests'}</Text>
            <FlatList
                data={requests}
                keyExtractor={(r) => r.id}
                refreshing={refreshing}
                onRefresh={load}
                ListEmptyComponent={<Text style={styles.empty}>No requests yet.</Text>}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>
                            {isDriver ? item.profiles?.full_name ?? 'Passenger' : 'Ride request'}
                        </Text>
                        <Text>{item.seats_needed} seat(s) · {item.status}</Text>
                        <Text style={styles.small}>{new Date(item.requested_time).toLocaleString()}</Text>

                        {item.status === 'pending' && isDriver && (
                            <View style={styles.row}>
                                <Pressable style={styles.accept} onPress={() => accept(item)}>
                                    <Text style={styles.buttonText}>Accept</Text>
                                </Pressable>
                                <Pressable style={styles.decline} onPress={() => run(() => declineRequest(item.id))}>
                                    <Text style={styles.buttonText}>Decline</Text>
                                </Pressable>
                            </View>
                        )}

                        {item.status === 'pending' && !isDriver && (
                            <Pressable style={styles.decline} onPress={() => run(() => cancelRequest(item.id))}>
                                <Text style={styles.buttonText}>Cancel request</Text>
                            </Pressable>
                        )}
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, paddingTop: 60 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
    empty: { textAlign: 'center', color: '#777', marginTop: 24 },
    card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, marginBottom: 10, gap: 4 },
    cardTitle: { fontWeight: '600' },
    small: { fontSize: 12, color: '#666' },
    row: { flexDirection: 'row', gap: 8, marginTop: 8 },
    accept: { flex: 1, backgroundColor: '#0d9488', padding: 10, borderRadius: 8, alignItems: 'center' },
    decline: { flex: 1, backgroundColor: '#dc2626', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 4 },
    buttonText: { color: 'white', fontWeight: '600' },
});