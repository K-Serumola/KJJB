import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { MapViewProps } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from './theme';

/*
 * THEMED MAP - the real map, dressed to match the app.
 *
 * Use it anywhere the old placeholder map was:
 *
 *   <ThemedMap />                       fills its parent
 *   <ThemedMap ref={mapRef} />          same, but you can call mapRef.current?.animateToRegion(...)
 *
 * What it does for you:
 *   - dark map colours in dark mode (picked from theme.tsx), normal map in light mode
 *   - hides Google's own grey "my location" button and toolbar (we draw our own)
 *   - starts over Gaborone, then jumps to where the phone is, once
 */

const GABORONE = { latitude: -24.6545, longitude: 25.9086 };

// Google Maps "style JSON". Colours come from darkColors in theme.tsx.
const DARK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#10141C' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#7A8494' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0D12' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A3140' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A4458' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B0D12' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const ThemedMap = forwardRef<MapView, MapViewProps>(function ThemedMap(props, ref) {
    const { isDark } = useTheme();
    const inner = useRef<MapView>(null);
    const [ready, setReady] = useState(false);

    // Lets the screen using ThemedMap hold a ref to the real MapView inside
    useImperativeHandle(ref, () => inner.current as MapView);

    // Once the map is drawn, jump to the phone's position (one time only)
    useEffect(() => {
        if (!ready) return;
        let cancelled = false;
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted' || cancelled) return;
            const loc = await Location.getCurrentPositionAsync({});
            if (cancelled) return;
            inner.current?.animateToRegion(
                {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                },
                600,
            );
        })();
        return () => {
            cancelled = true;
        };
    }, [ready]);

    return (
        <MapView
            {...props}
            ref={inner}
            style={StyleSheet.absoluteFill}
            initialRegion={{ ...GABORONE, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            customMapStyle={isDark ? DARK_MAP_STYLE : undefined}
            showsUserLocation
            showsMyLocationButton={false}
            toolbarEnabled={false}
            onMapReady={() => setReady(true)}
        />
    );
});

export default ThemedMap;
