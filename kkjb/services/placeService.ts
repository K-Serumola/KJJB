import { supabase } from '../lib/supabase';

// A real place, as returned by Google (through our Supabase function).
export interface Place {
    place_id: string;
    label: string;   // short name, e.g. "Airport Junction"
    address: string; // longer line, e.g. "Airport Junction Mall, Plot 1234, Gaborone"
    lat: number;
    lng: number;
}

export interface PlaceSuggestion {
    place_id: string;
    main: string;      // "Airport Junction"
    secondary: string; // "Gaborone, Botswana"
}

type Bias = { lat: number; lng: number } | null | undefined;

// Google groups "typing" + "tap a result" into one billing session using a token.
export function newSessionToken(): string {
    let token = '';
    for (let i = 0; i < 32; i++) token += Math.floor(Math.random() * 16).toString(16);
    return token;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('search-places', { body });
    if (error) {
        let message = error.message;
        try {
            message = (await (error as any).context.json()).error ?? message;
        } catch {}
        throw new Error(message);
    }
    return data as T;
}

export async function searchPlaces(
    input: string,
    sessionToken: string,
    bias?: Bias,
): Promise<PlaceSuggestion[]> {
    const data = await call<{ suggestions?: PlaceSuggestion[] }>({
        action: 'autocomplete',
        input,
        sessionToken,
        bias,
    });
    return data.suggestions ?? [];
}

export async function getPlaceDetails(placeId: string, sessionToken: string): Promise<Place> {
    const data = await call<{ place?: Place }>({ action: 'details', placeId, sessionToken });
    if (!data.place) throw new Error('Could not load that place');
    return data.place;
}

// For the quick chips: ask Google for the best match once, then remember it
// until the app closes so tapping a chip twice never costs twice.
const textCache = new Map<string, Promise<Place>>();

export function findPlaceByText(query: string, bias?: Bias): Promise<Place> {
    const key = query.trim().toLowerCase();
    const existing = textCache.get(key);
    if (existing) return existing;

    const request = call<{ place?: Place }>({ action: 'text', query, bias }).then((data) => {
        if (!data.place) throw new Error(`No place found for "${query}"`);
        // Handy while testing: copy these into your code if you want fixed coordinates.
        console.log('resolved place:', query, data.place.lat, data.place.lng);
        return data.place;
    });

    textCache.set(key, request);
    request.catch(() => textCache.delete(key)); // let the user retry after a failure
    return request;
}
