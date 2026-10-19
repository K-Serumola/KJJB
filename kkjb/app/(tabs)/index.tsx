import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getProfile } from '../../services/profileService';
import { submitRequest, findMatches, chooseRide, cancelRequest } from '../../services/requestService';
import { RideMatch, Role } from '../../types';

export default function Home() {
    const [userId, setUserId] = useState<string | null>(null);
    const [role, setRole] = useState<Role | null>(null);

    // example Gaborone coordinates, editable
    const [originLat, setOriginLat] = useState('-24.6550');
    const [originLng, setOriginLng] = useState('25.9090');
    const [destLat, setDestLat] = useState('-24.6660');
    const [destLng, setDestLng] = useState('25.9400');
    const [seats, setSeats] = useState('1');
    const [departsIn, setDepartsIn] = useState('30');

    const [loading, setLoading] = useState(false);
    const [requestId, setRequestId] = useState<string | null>(null);
    const [matches, setMatches] = useState<RideMatch[] | null>(null);
    const [requestedRideId, setRequestedRideId] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            (async () => {
                const { data } = await supabase.auth.getSession();
                const id = data.session?.user.id;
                if (!id) return;
                setUserId(id);
                setRole((await getProfile(id)).role);
            })();
        }, [])
    );

    async function handleSearch() {
        const nums = [originLat, originLng, destLat, destLng, seats, departsIn].map(Number);
        if (nums.some(isNaN) || nums[4] < 1) {
            Alert.alert('Invalid input', 'Check the numbers (seats must be at least 1).');
            return;
        }
        const [oLat, oLng, dLat, dLng, seatCount, mins] = nums;

        setLoading(true);
        try {
            // drop the previous search if no ride was picked from it
            if (requestId && !requestedRideId) await cancelRequest(requestId);

            const req = await submitRequest(
                userId!,
                { origin_lat: oLat, origin_lng: oLng, destination_lat: dLat, destination_lng: dLng },
                new Date(Date.now() + mins * 60000).toISOString(),
                seatCount
            );
            setRequestId(req.id);
            setRequestedRideId(null);
            setMatches(await findMatches(req.id));
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
        setLoading(false);
    }

    async function handleChoose(m: RideMatch) {
        if (!requestId) return;
        try {
            await chooseRide(requestId, m.ride.id);
            setRequestedRideId(m.ride.id);
            Alert.alert('Request sent', 'The driver will accept or decline it.');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    }

    if (role === null) return <View style={styles.center}><Text>Loading...</Text></View>;

    if (role === 'driver') {
        return (
            <View style={styles.center}>
                <Text style={styles.title}>Find a Ride</Text>
                <Text style={{ textAlign: 'center' }}>Switch to passenger on the Profile tab to search for rides.</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Find a Ride</Text>

            <Field label="Pickup latitude" value={originLat} onChange={setOriginLat} />
            <Field label="Pickup longitude" value={originLng} onChange={setOriginLng} />
            <Field label="Destination latitude" value={destLat} onChange={setDestLat} />
            <Field label="Destination longitude" value={destLng} onChange={setDestLng} />
            <Field label="Seats needed" value={seats} onChange={setSeats} />
            <Field label="Leave in (minutes)" value={departsIn} onChange={setDepartsIn} />

            <Pressable style={styles.button} onPress={handleSearch} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Searching...' : 'Find rides'}</Text>
            </Pressable>

            {matches !== null && matches.length === 0 && (
                <Text style={styles.empty}>No matching rides right now. Try again later or change the time.</Text>
            )}

            {matches?.map((m) => {
                const requested = requestedRideId === m.ride.id;
                return (
                    <View key={m.ride.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>{new Date(m.ride.departure_time).toLocaleString()}</Text>
                            <Text style={styles.score}>{m.score}</Text>
                        </View>
                        <Text>{m.ride.seats_available} seat(s) left</Text>
                        <Text style={styles.small}>
                            Pickup {m.pickup_distance_m} m away · detour {m.detour_m} m · {m.time_diff_min} min from your time
                        </Text>
                        <Pressable
                            style={[styles.choose, (requested || requestedRideId !== null) && styles.disabled]}
                            onPress={() => handleChoose(m)}
                            disabled={requestedRideId !== null}
                        >
                            <Text style={styles.buttonText}>{requested ? 'Requested ✓' : 'Request this ride'}</Text>
                        </Pressable>
                    </View>
                );
            })}
        </ScrollView>
    );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <View>
            <Text style={styles.label}>{label}</Text>
            <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="numbers-and-punctuation" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, padding: 24, paddingTop: 60, gap: 10 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    label: { fontSize: 12, color: '#555', marginBottom: 2 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
    button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
    buttonText: { color: 'white', fontWeight: '600' },
    empty: { textAlign: 'center', color: '#777', marginTop: 12 },
    card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, gap: 4, marginTop: 8 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    cardTitle: { fontWeight: '600' },
    score: { fontWeight: 'bold', color: '#0d9488' },
    small: { fontSize: 12, color: '#666' },
    choose: { backgroundColor: '#0d9488', padding: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
    disabled: { opacity: 0.5 },
});