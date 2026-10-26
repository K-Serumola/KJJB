declare const Deno: any;
// @ts-ignore: npm: specifier is resolved by Deno at deploy time
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore: Deno requires explicit local TypeScript extensions at deploy time.
import { computeDrivingRoute, decodePolyline, type DrivingRoute, type LatLng } from '../_shared/googleRoutes.ts';

type Route = DrivingRoute;
type Near = { distanceM: number; alongM: number };

// ---------- geometry helpers ----------
const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// distance from point p to segment a-b (flat-earth approximation, fine at city scale)
function pointToSegment(p: LatLng, a: LatLng, b: LatLng) {
  const k = Math.cos(rad(a.lat));
  const px = rad(p.lng - a.lng) * R * k;
  const py = rad(p.lat - a.lat) * R;
  const bx = rad(b.lng - a.lng) * R * k;
  const by = rad(b.lat - a.lat) * R;
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return { distanceM: Math.hypot(px - t * bx, py - t * by), t };
}

// closest point on a route: how far away it is, and how far along the route it sits
function nearestOnRoute(p: LatLng, pts: LatLng[]): Near {
  let best: Near = { distanceM: Infinity, alongM: 0 };
  let travelled = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const segLen = haversineM(pts[i], pts[i + 1]);
    const { distanceM, t } = pointToSegment(p, pts[i], pts[i + 1]);
    if (distanceM < best.distanceM) best = { distanceM, alongM: travelled + t * segLen };
    travelled += segLen;
  }
  return best;
}

// ---------- RouteService ----------
function routeStoredOnRide(ride: any): Route | null {
  if (
    typeof ride.route_polyline !== 'string' ||
    typeof ride.route_distance_m !== 'number' ||
    typeof ride.est_duration_s !== 'number'
  ) {
    return null;
  }

  try {
    const points = decodePolyline(ride.route_polyline);
    if (points.length < 2) return null;
    return {
      polyline: ride.route_polyline,
      distanceM: ride.route_distance_m,
      durationS: ride.est_duration_s,
      points,
    };
  } catch {
    return null;
  }
}

// ---------- MatchingService ----------
class MatchingService {
  private maxPickupDistanceM = 1000;
  private maxDetourM = 3000;
  private timeWindowMin = 60;

  async findMatches(request: any, rides: any[]) {
    const results: any[] = [];
    for (const ride of rides) {
      const route =
        routeStoredOnRide(ride) ??
        (await computeDrivingRoute(
          { lat: ride.origin_lat, lng: ride.origin_lng },
          { lat: ride.destination_lat, lng: ride.destination_lng },
        ));
      // This is included in the function response so the client can render the
      // exact route immediately. Persisting it can be added later as a cache.
      ride.route_polyline = route.polyline;
      ride.route_distance_m = route.distanceM;
      ride.est_duration_s = route.durationS;
      const pickup = this.calcPickupDistance({ lat: request.origin_lat, lng: request.origin_lng }, route);
      const dropoff = this.calcPickupDistance({ lat: request.destination_lat, lng: request.destination_lng }, route);
      const detourM = this.calcDetour(pickup, dropoff);
      const timeDiffMin =
          Math.abs(new Date(ride.departure_time).getTime() - new Date(request.requested_time).getTime()) / 60000;

      if (!this.isCompatible(pickup, dropoff, detourM, timeDiffMin)) continue;

      results.push({
        ride,
        pickup_distance_m: Math.round(pickup.distanceM),
        detour_m: Math.round(detourM),
        time_diff_min: Math.round(timeDiffMin),
        score: this.scoreMatch(pickup.distanceM, detourM, timeDiffMin),
      });
    }
    return results.sort((a, b) => b.score - a.score);
  }

  private isCompatible(pickup: Near, dropoff: Near, detourM: number, timeDiffMin: number): boolean {
    return (
        pickup.distanceM <= this.maxPickupDistanceM &&
        dropoff.distanceM <= this.maxPickupDistanceM &&
        pickup.alongM < dropoff.alongM && // same direction as the driver
        detourM <= this.maxDetourM &&
        timeDiffMin <= this.timeWindowMin
    );
  }

  private calcPickupDistance(point: LatLng, route: Route): Near {
    return nearestOnRoute(point, route.points);
  }

  // approximation: driver leaves the route and comes back for both pickup and dropoff
  private calcDetour(pickup: Near, dropoff: Near): number {
    return 2 * (pickup.distanceM + dropoff.distanceM);
  }

  // 0-100: closer pickup, smaller detour and closer departure time score higher
  private scoreMatch(pickupM: number, detourM: number, timeDiffMin: number): number {
    const s =
        0.5 * (1 - pickupM / this.maxPickupDistanceM) +
        0.3 * (1 - detourM / this.maxDetourM) +
        0.2 * (1 - timeDiffMin / this.timeWindowMin);
    return Math.round(Math.max(0, Math.min(1, s)) * 100);
  }
}

// ---------- HTTP handler ----------
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  try {
    const { request_id } = await req.json();
    const url = Deno.env.get('SUPABASE_URL')!;

    // acts as the signed-in user, so RLS applies
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });
    // service role bypasses RLS; used only to write match_results
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not signed in' }, 401);

    const { data: request } = await userClient
        .from('ride_requests').select('*').eq('id', request_id).single();
    if (!request) return json({ error: 'Request not found' }, 404);
    if (request.passenger_id !== user.id) return json({ error: 'Not your request' }, 403);

    const { data: rides, error: ridesErr } = await userClient
        .from('rides').select('*')
        .eq('status', 'active')
        .gte('departure_time', new Date().toISOString()) // skip rides that already left
        .gte('seats_available', request.seats_needed)
        .neq('driver_id', user.id);
    if (ridesErr) throw ridesErr;

    const matches = await new MatchingService().findMatches(request, rides ?? []);

    await admin.from('match_results').delete().eq('request_id', request_id);
    if (matches.length) {
      const { error: insErr } = await admin.from('match_results').insert(
          matches.map((m) => ({
            request_id,
            ride_id: m.ride.id,
            pickup_distance_m: m.pickup_distance_m,
            detour_m: m.detour_m,
            time_diff_min: m.time_diff_min,
            score: m.score,
          })),
      );
      if (insErr) throw insErr;
    }

    return json({ matches });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
