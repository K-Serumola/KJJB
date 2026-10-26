import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';

export default function LiveMap() {
    const [start, setStart] = useState<{ latitude: number; longitude: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Location permission denied');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({});
            setStart({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        })();
    }, []);

    if (error) return <View style={styles.center}><Text>{error}</Text></View>;
    if (!start) return <View style={styles.center}><Text>Finding you...</Text></View>;

    return (
        <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{ ...start, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
            showsUserLocation
            followsUserLocation
        />
    );
}

const styles = StyleSheet.create({ center: { flex: 1, justifyContent: 'center', alignItems: 'center' } });