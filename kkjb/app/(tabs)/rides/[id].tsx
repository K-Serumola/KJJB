import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import WireframeHeader from '../../../components/WireframeHeader';
import { useUser } from '../../../components/UserContext';
import { Colors, useTheme, useThemedStyles } from '../../../components/theme';
import { useTabBarHeight } from '../../../components/layout';
import { getRide } from '../../../services/rideService';
import { submitRequest, chooseRide, getMyOpenRequest, cancelRequest } from '../../../services/requestService';
import { getProfile } from '../../../services/profileService';
import { Ride } from '../../../types';

/*
 * RIDE DETAILS - lives at app/(tabs)/rides/[id].tsx
 *
 * Opened by tapping an offer on the Activity tab. Shows the ride, the
 * route, who's driving, and a "Request to join" button.
 */

// "Sat, Oct 19 · 2:41 AM"
function formatWhen(iso: string) {
    const d = new Date(iso);
    const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${date} · ${time}`;
}

const coord = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function getInitials(name: string) {
    return (
        name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0].toUpperCase())
            .join('') || '?'
    );
}

export default function RideDetails() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const tabBarHeight = useTabBarHeight();
    const { user } = useUser();

    const [ride, setRide] = useState<Ride | null>(null);
    const [driverName, setDriverName] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [hasOpenRequest, setHasOpenRequest] = useState(false); // you can only have one request at a time

    useEffect(() => {
        if (!user) return;
        getMyOpenRequest(user.id)
            .then((req) => setHasOpenRequest(!!req))
            .catch(() => {}); // the database still blocks a second request, so this is only for the button text
    }, [user?.id]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const r = await getRide(id);
                if (cancelled) return;
                setRide(r);

                // The driver's name is a nice-to-have: if it can't be loaded, we just say "Driver"
                try {
                    const p = (await getProfile(r.driver_id)) as unknown as { full_name?: string | null };
                    if (!cancelled) setDriverName(p?.full_name ?? null);
                } catch {
                    /* keep the fallback */
                }
            } catch (e: any) {
                if (!cancelled) {
                    setFailed(true);
                    Alert.alert('Error', e.message);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    async function handleRequest() {
        if (!ride || !user) return;
        setLoading(true);
        let created: string | null = null;
        try {
            // no map picker yet, so the request uses the ride's own route as the journey
            const journey = {
                origin_lat: ride.origin_lat,
                origin_lng: ride.origin_lng,
                destination_lat: ride.destination_lat,
                destination_lng: ride.destination_lng,
            };
            const req = await submitRequest(user.id, journey, ride.departure_time);
            created = req.id;
            await chooseRide(req.id, ride.id);
            setSent(true);
            Alert.alert('Request sent', 'The driver will accept or decline it. You can follow it under Activity → Requests.');
        } catch (e: any) {
            // chooseRide failed (e.g. you already have a request open), so close the
            // request we just created instead of leaving it behind
            if (created && !sent) cancelRequest(created).catch(() => {});
            if (String(e.message).includes('open request')) setHasOpenRequest(true);
            Alert.alert('Could not send request', e.message);
        }
        setLoading(false);
    }

    if (!ride) {
        return (
            <View style={styles.container}>
                <WireframeHeader title="Ride details" showBackButton />
                <Text style={styles.centerText}>{failed ? "Couldn't load this ride." : 'Loading…'}</Text>
            </View>
        );
    }

    const isOwnRide = ride.driver_id === user?.id;
    const isOpen = ride.status === 'active' && ride.seats_available >= 1;
    const canRequest = !isOwnRide && !sent && !loading && isOpen && !hasOpenRequest;

    const pill =
        ride.status === 'active' || ride.status === 'completed'
            ? { bg: colors.successSoft, fg: colors.success }
            : ride.status === 'cancelled'
                ? { bg: colors.dangerSoft, fg: colors.danger }
                : { bg: colors.accentSoft, fg: colors.accentText };

    const buttonLabel = loading
        ? 'Sending…'
        : sent
            ? 'Request sent'
            : hasOpenRequest
                ? 'You already have a request open'
                : ride.seats_available < 1
                ? 'Ride is full'
                : !isOpen
                    ? 'Not available'
                    : 'Request to join';

    const shownName = driverName ?? 'Driver';

    return (
        <View style={styles.container}>
            <WireframeHeader title="Ride details" subtitle={formatWhen(ride.departure_time)} showBackButton />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 16 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Summary */}
                <View style={styles.card}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.bigText}>{formatWhen(ride.departure_time)}</Text>
                        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                            <Text style={[styles.pillText, { color: pill.fg }]}>{capitalise(ride.status)}</Text>
                        </View>
                    </View>
                    <Text style={styles.subText}>
                        {ride.seats_available} seat{ride.seats_available === 1 ? '' : 's'} left
                    </Text>
                </View>

                {/* Route */}
                <Text style={styles.sectionLabel}>Route</Text>
                <View style={styles.card}>
                    <View style={styles.routeRow}>
                        <View style={styles.originDot} />
                        <View style={styles.flexGrow}>
                            <Text style={styles.routeLabel}>Pickup</Text>
                            <Text style={styles.routeValue}>{coord(ride.origin_lat, ride.origin_lng)}</Text>
                        </View>
                    </View>
                    <View style={styles.connector} />
                    <View style={styles.routeRow}>
                        <View style={styles.destDot} />
                        <View style={styles.flexGrow}>
                            <Text style={styles.routeLabel}>Drop-off</Text>
                            <Text style={styles.routeValue}>{coord(ride.destination_lat, ride.destination_lng)}</Text>
                        </View>
                    </View>
                </View>

                {/* Driver */}
                <Text style={styles.sectionLabel}>Driver</Text>
                <View style={styles.card}>
                    <View style={styles.driverRow}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{getInitials(shownName)}</Text>
                        </View>
                        <View style={styles.flexGrow}>
                            <Text style={styles.bigTextSmall}>{shownName}</Text>
                            <Text style={styles.subText}>{isOwnRide ? 'This is you' : 'Offering this ride'}</Text>
                        </View>
                    </View>
                </View>

                {/* Action */}
                {isOwnRide ? (
                    <View style={styles.noteCard}>
                        <Text style={styles.noteText}>This is your ride.</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.primaryBtn, !canRequest && styles.btnDisabled]}
                        onPress={handleRequest}
                        disabled={!canRequest}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryBtnText}>{buttonLabel}</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: c.bg },
        scroll: { flex: 1 },
        scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
        centerText: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40 },

        sectionLabel: {
            color: c.textMuted,
            fontSize: 11.5,
            fontWeight: '600',
            marginBottom: 8,
            marginLeft: 2,
        },
        card: {
            backgroundColor: c.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: c.border,
        },
        rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        flexGrow: { flex: 1 },

        bigText: { flex: 1, marginRight: 8, color: c.textPrimary, fontSize: 16, fontWeight: '600' },
        bigTextSmall: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
        subText: { color: c.textSecondary, fontSize: 12.5, marginTop: 4 },
        pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
        pillText: { fontSize: 11, fontWeight: '600' },

        routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        originDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
        destDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: c.danger },
        connector: { width: 2, height: 18, backgroundColor: c.borderStrong, marginLeft: 4, marginVertical: 4 },
        routeLabel: { color: c.textMuted, fontSize: 11.5 },
        routeValue: { color: c.textPrimary, fontSize: 14, fontWeight: '500', marginTop: 2 },

        driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        avatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },

        primaryBtn: {
            backgroundColor: c.accent,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
        },
        primaryBtnText: { color: c.onAccent, fontSize: 14.5, fontWeight: '600' },
        btnDisabled: { opacity: 0.5 },

        noteCard: {
            backgroundColor: c.inset,
            borderRadius: 12,
            padding: 14,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: c.border,
        },
        noteText: { color: c.textSecondary, fontSize: 13.5 },
    });