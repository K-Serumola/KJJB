import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

/*
 * useMyLocation - "where is this phone right now?", updating live.
 *
 *   const { coords, error } = useMyLocation();
 *
 * coords is null until the first GPS fix arrives. error is set if the user
 * said no to the location permission.
 *
 * It asks Android/iOS for permission, then subscribes to GPS updates
 * (about every 3 seconds, or every 5 metres moved). When the screen using
 * it goes away, the subscription is switched off so it doesn't drain battery.
 */

export type Coords = { latitude: number; longitude: number };

export function useMyLocation() {
    const [coords, setCoords] = useState<Coords | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let subscription: Location.LocationSubscription | undefined;
        let cancelled = false;

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Location permission denied');
                return;
            }
            const sub = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
                (loc) =>
                    setCoords({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                    }),
            );
            // The screen may have closed while we were waiting for permission
            if (cancelled) sub.remove();
            else subscription = sub;
        })();

        return () => {
            cancelled = true;
            subscription?.remove();
        };
    }, []);

    return { coords, error };
}
