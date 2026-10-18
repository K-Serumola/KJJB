import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getProfile } from '../../services/profileService';
import { postRide } from '../../services/rideService';
import { Role } from '../../types';

export default function PostRide() {
    const [userId, setUserId] = useState<string | null>(null);
    const [role, setRole] = useState<Role | null>(null);

    //TODO replace with mappicker
    const [originLat, setOriginLat] = useState('-24.6545');
    const [originLng, setOriginLng] = useState('25.9086');
    const [destLat, setDestLat] = useState('-24.6665');
    const [destLng, setDestLng] = useState('25.9407');
    const [seats, setSeats] = useState('3');

    //TODO replace with date picker
    const [departsIn, setDepartsIn] = useState('30');
    const [loading, setLoading] = useState(false);

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

    async function handlePost() {
        const nums = [originLat, originLng, destLat, destLng, seats, departsIn].map(Number);
        if (nums.some(isNaN) || nums[4] < 1) {
            Alert.alert('Invalid input', 'Check the numbers (seats must be at least 1).');
            return;
        }
        const [oLat, oLng, dLat, dLng, seatCount, mins] = nums;
        const departure = new Date(Date.now() + mins * 60000).toISOString();

        setLoading(true);
        try {
            await postRide(
                userId!,
                { origin_lat: oLat, origin_lng: oLng, destination_lat: dLat, destination_lng: dLng },
                seatCount,
                departure
            );
            Alert.alert('Ride posted');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
        setLoading(false);
    }

    if (role === null) return <View style={styles.container}><Text>Loading...</Text></View>;

    if (role !== 'driver') {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Post a Ride</Text>
                <Text style={{ textAlign: 'center' }}>Switch to driver on the Profile tab to post rides.</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Post a Ride</Text>
            <Field label="Origin latitude" value={originLat} onChange={setOriginLat} />
            <Field label="Origin longitude" value={originLng} onChange={setOriginLng} />
            <Field label="Destination latitude" value={destLat} onChange={setDestLat} />
            <Field label="Destination longitude" value={destLng} onChange={setDestLng} />
            <Field label="Seats available" value={seats} onChange={setSeats} />
            <Field label="Departs in (minutes)" value={departsIn} onChange={setDepartsIn} />
            <Pressable style={styles.button} onPress={handlePost} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Posting...' : 'Post ride'}</Text>
            </Pressable>
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
    container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 10 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    label: { fontSize: 12, color: '#555', marginBottom: 2 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
    button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
    buttonText: { color: 'white', fontWeight: '600' },
});