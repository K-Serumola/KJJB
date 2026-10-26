declare const Deno: any;
// @ts-ignore: npm: specifier is resolved by Deno at deploy time
import { createClient } from 'npm:@supabase/supabase-js@2';

// One function, three jobs (the app picks one with `action`):
//   autocomplete -> suggestions while the user types   (cheap)
//   details      -> lat/lng of the suggestion they tapped
//   text         -> best single match for a text (used by the quick chips)
//
// The Google key stays here on the server, like compute-route.

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const DETAILS_URL = 'https://places.googleapis.com/v1/places/';

// Gaborone centre. Used to favour nearby results when the phone has no GPS yet.
const GABORONE = { lat: -24.6545, lng: 25.9086 };
const BIAS_RADIUS_M = 30000; // Google allows 0 - 50000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isLat(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 90;
}
function isLng(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 180;
}

function biasFrom(raw: any) {
  const lat = isLat(raw?.lat) ? raw.lat : GABORONE.lat;
  const lng = isLng(raw?.lng) ? raw.lng : GABORONE.lng;
  return { circle: { center: { latitude: lat, longitude: lng }, radius: BIAS_RADIUS_M } };
}

function cleanText(value: unknown, max = 120): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length >= 1 && text.length <= max ? text : null;
}

// Place ids and session tokens are plain URL-safe strings. Anything else is rejected.
const SAFE_ID = /^[A-Za-z0-9_-]{1,300}$/;

async function google(url: string, apiKey: string, fieldMask: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Google Places request failed (${response.status})`);
  }
  return payload;
}

function toPlace(p: any) {
  const lat = p?.location?.latitude;
  const lng = p?.location?.longitude;
  if (!p?.id || !isLat(lat) || !isLng(lng)) throw new Error('Google did not return a usable place');
  const label = p.displayName?.text ?? p.formattedAddress ?? 'Selected place';
  return {
    place_id: String(p.id),
    label: String(label),
    address: String(p.formattedAddress ?? label),
    lat,
    lng,
  };
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json();

    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Not signed in' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not signed in' }, 401);

    // Same secret as the routes function, unless you made a separate Places key.
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY') ?? Deno.env.get('GOOGLE_ROUTES_API_KEY');
    if (!apiKey) {
      return json({ error: 'Place search is not configured. Set the GOOGLE_ROUTES_API_KEY Supabase secret.' }, 500);
    }

    if (body.action === 'autocomplete') {
      const input = cleanText(body.input, 100);
      if (!input) return json({ error: 'Type something to search' }, 400);

      const payload: Record<string, unknown> = {
        input,
        includedRegionCodes: ['bw'],
        languageCode: 'en',
        locationBias: biasFrom(body.bias),
      };
      if (typeof body.sessionToken === 'string' && SAFE_ID.test(body.sessionToken)) {
        payload.sessionToken = body.sessionToken;
      }

      const data = await google(
        AUTOCOMPLETE_URL,
        apiKey,
        'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
        { method: 'POST', body: JSON.stringify(payload) },
      );

      const suggestions = (data.suggestions ?? [])
        .map((s: any) => s.placePrediction)
        .filter((p: any) => p?.placeId)
        .map((p: any) => ({
          place_id: String(p.placeId),
          main: String(p.structuredFormat?.mainText?.text ?? ''),
          secondary: String(p.structuredFormat?.secondaryText?.text ?? ''),
        }));
      return json({ suggestions });
    }

    if (body.action === 'details') {
      const placeId = body.placeId;
      if (typeof placeId !== 'string' || !SAFE_ID.test(placeId)) {
        return json({ error: 'Invalid place' }, 400);
      }
      let url = DETAILS_URL + encodeURIComponent(placeId);
      if (typeof body.sessionToken === 'string' && SAFE_ID.test(body.sessionToken)) {
        url += `?sessionToken=${encodeURIComponent(body.sessionToken)}`;
      }
      const data = await google(url, apiKey, 'id,displayName,formattedAddress,location');
      return json({ place: toPlace(data) });
    }

    if (body.action === 'text') {
      const query = cleanText(body.query, 100);
      if (!query) return json({ error: 'Type something to search' }, 400);

      const data = await google(
        TEXT_SEARCH_URL,
        apiKey,
        'places.id,places.displayName,places.formattedAddress,places.location',
        {
          method: 'POST',
          body: JSON.stringify({
            textQuery: query,
            regionCode: 'BW',
            languageCode: 'en',
            pageSize: 1,
            locationBias: biasFrom(body.bias),
          }),
        },
      );
      const first = data.places?.[0];
      if (!first) return json({ error: `No place found for "${query}"` }, 404);
      return json({ place: toPlace(first) });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    return json({ error: String((error as Error).message ?? error) }, 500);
  }
});
