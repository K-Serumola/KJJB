declare const Deno: any;
// @ts-ignore: npm: specifier is resolved by Deno at deploy time
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore: Deno requires explicit local TypeScript extensions at deploy time.
import { computeDrivingRoute, type LatLng } from '../_shared/googleRoutes.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== 'object') return false;
  const point = value as LatLng;
  return (
    typeof point.lat === 'number' &&
    Number.isFinite(point.lat) &&
    Math.abs(point.lat) <= 90 &&
    typeof point.lng === 'number' &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lng) <= 180
  );
}

Deno.serve(async (req: Request) => {
  try {
    const { origin, destination } = await req.json();
    if (!isLatLng(origin) || !isLatLng(destination)) {
      return json({ error: 'Origin and destination must be valid latitude/longitude points' }, 400);
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ error: 'Not signed in' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not signed in' }, 401);

    const route = await computeDrivingRoute(origin, destination);
    return json({
      route: {
        polyline: route.polyline,
        distance_m: route.distanceM,
        duration_s: route.durationS,
      },
    });
  } catch (error) {
    return json({ error: String((error as Error).message ?? error) }, 500);
  }
});
