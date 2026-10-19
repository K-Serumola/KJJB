import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { searchRides } from '../../../services/rideService';
import { Ride } from '../../../types';

export default function Rides() {
    const [rides, setRides] = useState<Ride[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        setRefreshing(true);
        try {
            setRides(await searchRides());
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
        setRefreshing(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Available Rides</Text>
            <FlatList
                data={rides}
                keyExtractor={(r) => r.id}
                refreshing={refreshing}
                onRefresh={load}
                ListEmptyComponent={<Text style={styles.empty}>No active rides yet.</Text>}
                renderItem={({ item }) => (
                    <Link href={`/(tabs)/rides/${item.id}`} asChild>
                        <Pressable style={styles.card}>
                            <Text style={styles.cardTitle}>{new Date(item.departure_time).toLocaleString()}</Text>
                            <Text>{item.seats_available} seat(s) left</Text>
                            <Text style={styles.small}>
                                {item.origin_lat.toFixed(3)}, {item.origin_lng.toFixed(3)} →{' '}
                                {item.destination_lat.toFixed(3)}, {item.destination_lng.toFixed(3)}
                            </Text>
                        </Pressable>
                    </Link>
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
});