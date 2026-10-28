// lib/tracking.ts
// Live tracking: the driver sends GPS to Supabase, the passenger listens.
// No Google API calls are made here.

import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from './supabase';

export type DriverPosition = {
  lat: number;
  lng: number;
  heading: number | null;
  updatedAt: string;
};

// ---------- DRIVER SIDE ----------
// Call after the driver accepts a passenger. Returns a stop() function.
// Call stop() when the ride is completed or cancelled.
export async function startSharingLocation(rideId: string, driverId: string) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 8000,   // at most one update every 8 seconds
      distanceInterval: 15, // and only if moved 15 m
    },
    async (pos) => {
      await supabase.from('driver_locations').upsert({
        ride_id: rideId,
        driver_id: driverId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading ?? null,
        updated_at: new Date().toISOString(),
      });
    }
  );

  return () => sub.remove();
}

// ---------- PASSENGER SIDE ----------
// Returns the driver's latest position, updating live.
export function useDriverPosition(rideId: string | null) {
  const [position, setPosition] = useState<DriverPosition | null>(null);

  useEffect(() => {
    if (!rideId) return;
    let active = true;

    const toPos = (r: any): DriverPosition => ({
      lat: r.lat,
      lng: r.lng,
      heading: r.heading,
      updatedAt: r.updated_at,
    });

    // 1. Get the last known position straight away
    supabase
      .from('driver_locations')
      .select('*')
      .eq('ride_id', rideId)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setPosition(toPos(data));
      });

    // 2. Listen for new positions
    const channel = supabase
      .channel(`driver-location-${rideId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `ride_id=eq.${rideId}` },
        (payload) => {
          if (active && payload.new) setPosition(toPos(payload.new));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [rideId]);

  return position;
}

// ---------- ETA (no Google, just maths) ----------
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rough ETA in minutes, assuming ~30 km/h city driving.
export function etaMinutes(meters: number, speedKmh = 30) {
  return Math.max(1, Math.round(meters / ((speedKmh * 1000) / 60)));
}
