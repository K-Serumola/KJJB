declare const Deno: any;

export type LatLng = { lat: number; lng: number };

export type DrivingRoute = {
  distanceM: number;
  durationS: number;
  polyline: string;
  points: LatLng[];
};

type GoogleRoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
  }>;
  error?: { message?: string };
};

const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const GOOGLE_ROUTES_FIELD_MASK =
  'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline';

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) throw new Error('Google returned an invalid route polyline');
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      if (index >= encoded.length) throw new Error('Google returned an invalid route polyline');
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function secondsFromGoogleDuration(duration: string | undefined): number {
  const seconds = Number.parseFloat(duration?.replace(/s$/, '') ?? '');
  if (!Number.isFinite(seconds)) throw new Error('Google returned an invalid route duration');
  return Math.round(seconds);
}

export async function computeDrivingRoute(origin: LatLng, destination: LatLng): Promise<DrivingRoute> {
  const apiKey = Deno.env.get('GOOGLE_ROUTES_API_KEY');
  if (!apiKey) {
    throw new Error('Routing is not configured. Set the GOOGLE_ROUTES_API_KEY Supabase secret.');
  }

  const response = await fetch(GOOGLE_ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': GOOGLE_ROUTES_FIELD_MASK,
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      computeAlternativeRoutes: false,
      units: 'METRIC',
    }),
  });

  const payload = (await response.json()) as GoogleRoutesResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Google Routes request failed (${response.status})`);
  }

  const route = payload.routes?.[0];
  const encodedPolyline = route?.polyline?.encodedPolyline;
  const distanceMeters = route?.distanceMeters;
  if (!route || !encodedPolyline || typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters)) {
    throw new Error('Google did not return a usable driving route');
  }

  const points = decodePolyline(encodedPolyline);
  return {
    distanceM: Math.round(distanceMeters),
    durationS: secondsFromGoogleDuration(route.duration),
    polyline: encodedPolyline,
    // A zero-length route has only one point; preserve both endpoints so
    // route-overlap calculations remain well-defined.
    points: points.length >= 2 ? points : [origin, destination],
  };
}
