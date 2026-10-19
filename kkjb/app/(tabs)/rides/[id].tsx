import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { getRide } from '../../../services/rideService';
import { submitRequest, chooseRide } from '../../../services/requestService';
import { Ride } from '../../../types';

export default function RideDetails() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [ride, setRide] = useState<Ride | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getSession();
            setUserId(data.session?.user.id ?? null);
            try {
                setRide(await getRide(id));
            } catch (e: any) {
                Alert.alert('Error', e.message);
            }
        })();
    }, [id]);

    async function handleRequest() {
        if (!ride || !userId) return;
        setLoading(true);
        try {
            // no map picker yet, so the request uses the ride's own route as the journey
            const journey = {
                origin_lat: ride.origin_lat,
                origin_lng: ride.origin_lng,
                destination_lat: ride.destination_lat,
                destination_lng: ride.destination_lng,
            };
            const req = await submitRequest(userId, journey, ride.departure_time);
            await chooseRide(req.id, ride.id);
            Alert.alert('Request sent', 'The driver will accept or decline it.');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
        setLoading(false);
    }

    if (!ride) return <View style={styles.container}><Text>Loading...</Text></View>;

    const isOwnRide = ride.driver_id === userId;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ride Details</Text>
            <Text>Departs: {new Date(ride.departure_time).toLocaleString()}</Text>
            <Text>Seats left: {ride.seats_available}</Text>
            <Text>From: {ride.origin_lat}, {ride.origin_lng}</Text>
            <Text>To: {ride.destination_lat}, {ride.destination_lng}</Text>
            <Text>Status: {ride.status}</Text>

            {isOwnRide ? (
                <Text style={styles.note}>This is your ride.</Text>
            ) : (
                <Pressable style={styles.button} onPress={handleRequest} disabled={loading || ride.seats_available < 1}>
                    <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Request to join'}</Text>
                </Pressable>
            )}

            <Pressable onPress={() => router.back()}>
                <Text style={styles.back}>Back</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, gap: 8 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
    note: { textAlign: 'center', color: '#777', marginTop: 12 },
    button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
    buttonText: { color: 'white', fontWeight: '600' },
    back: { color: '#2563eb', textAlign: 'center', marginTop: 12 },
});