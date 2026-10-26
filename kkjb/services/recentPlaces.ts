import AsyncStorage from '@react-native-async-storage/async-storage';
import { Place } from './placeService';

// Places the user has actually used, newest first. Saved on this phone only.
const KEY = 'recent_places_v1';
const MAX_RECENTS = 5;

export async function getRecentPlaces(): Promise<Place[]> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch (e: any) {
        console.warn('Could not read recent places:', e?.message ?? e);
        return [];
    }
}

// Call this when a place was really used (a ride was searched or posted).
export async function addRecentPlace(place: Place): Promise<void> {
    try {
        const current = await getRecentPlaces();
        const next = [place, ...current.filter((p) => p.place_id !== place.place_id)].slice(0, MAX_RECENTS);
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch (e: any) {
        console.warn('Could not save recent place:', e?.message ?? e);
    }
}

export async function removeRecentPlace(placeId: string): Promise<void> {
    try {
        const current = await getRecentPlaces();
        await AsyncStorage.setItem(KEY, JSON.stringify(current.filter((p) => p.place_id !== placeId)));
    } catch (e: any) {
        console.warn('Could not remove recent place:', e?.message ?? e);
    }
}
