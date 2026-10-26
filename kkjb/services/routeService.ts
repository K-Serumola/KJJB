import { supabase } from '../lib/supabase';
import { Journey } from '../types';

export interface CalculatedRoute {
    polyline: string;
    distance_m: number;
    duration_s: number;
}

const routeCache = new Map<string, Promise<CalculatedRoute>>();

// Round to 4 decimals (about 11 m). GPS jitters by a few metres between taps,
// and the exact numbers made every tap look like a "new" trip to Google.
const round = (n: number) => n.toFixed(4);

function cacheKey(journey: Journey) {
    return [
        round(journey.origin_lat),
        round(journey.origin_lng),
        round(journey.destination_lat),
        round(journey.destination_lng),
    ].join(',');
}

export async function calculateDrivingRoute(journey: Journey): Promise<CalculatedRoute> {
    const key = cacheKey(journey);
    const existing = routeCache.get(key);
    if (existing) return existing;

    const request = supabase.functions
        .invoke('compute-route', {
            body: {
                origin: { lat: journey.origin_lat, lng: journey.origin_lng },
                destination: { lat: journey.destination_lat, lng: journey.destination_lng },
            },
        })
        .then(async ({ data, error }) => {
            if (error) {
                let message = error.message;
                try {
                    message = (await (error as any).context.json()).error ?? message;
                } catch {}
                throw new Error(message);
            }

            const route = data?.route as CalculatedRoute | undefined;
            if (!route?.polyline || !Number.isFinite(route.distance_m) || !Number.isFinite(route.duration_s)) {
                throw new Error('The route service returned an invalid route');
            }
            return route;
        });

    routeCache.set(key, request);
    try {
        return await request;
    } catch (error) {
        routeCache.delete(key);
        throw error;
    }
}
