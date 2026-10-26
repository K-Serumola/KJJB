import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import WireframeHeader from '../../../components/WireframeHeader';
import CancelTripModal from '../../../components/CancelTripModal';
import { useAppNavigation } from '../../../components/NavigationContext';
import { useUser } from '../../../components/UserContext';
import { useNotifications } from '../../../components/NotificationContext';
import { Colors, useTheme, useThemedStyles } from '../../../components/theme';
import { useTabBarHeight } from '../../../components/layout';
import { searchRides } from '../../../services/rideService';
import {
    getRequestsForDriver,
    getRequestHistory,
    approveRequest,
    declineRequest,
    cancelRequest,
} from '../../../services/requestService';
import { markPickedUp, completeTrip } from '../../../services/tripService';
import { Ride, RequestWithPassenger } from '../../../types';

/*
 * ACTIVITY TAB - lives at app/(tabs)/rides/index.tsx
 *
 *   Live ride card      shown while you're in a ride (from NavigationContext)
 *   Offers tab          rides drivers have posted that you can join (real data)
 *   Requests / Completed  your requests (real data). A tapped notification opens "Requests".
 *
 * Drivers also get Accept / Decline on pending requests here (the old
 * Requests screen has no tab button any more). Posting a ride is done on the
 * Drive tab.
 */

type Tab = 'all' | 'completed' | 'offers';

type Row =
    | { kind: 'offer'; ride: Ride }
    | { kind: 'request'; req: RequestWithPassenger };

const TABS: { value: Tab; label: string }[] = [
    { value: 'all', label: 'Requests' },
    { value: 'completed', label: 'Completed' },
    { value: 'offers', label: 'Offers' },
];

// "Sep 14 · 8:15 AM"
function formatWhen(iso: string) {
    const d = new Date(iso);
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${date} · ${time}`;
}

const coord = (lat: number, lng: number) => `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The price the passenger offered (Pula), or null if none was saved.
const fareOf = (req: RequestWithPassenger): number | null =>
    req.fare_offer === null || req.fare_offer === undefined ? null : Number(req.fare_offer);

// What happens after a driver accepts a request:
//   passenger: sees a 4-digit PIN to tell the driver when boarding
//   driver:    types that PIN to start the trip, then taps "Complete trip"
function TripActions({
    req,
    isDriver,
    onDone,
}: {
    req: RequestWithPassenger;
    isDriver: boolean;
    onDone: () => void;
}) {
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [pinInput, setPinInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const pickedUp = !!req.picked_up_at;

    async function act(action: () => Promise<void>) {
        setBusy(true);
        try {
            await action();
            onDone();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
        setBusy(false);
    }

    const verify = () => {
        if (pinInput.trim() !== req.pin) {
            Alert.alert('Wrong PIN', 'Ask the passenger to check their PIN and try again.');
            return;
        }
        act(() => markPickedUp(req.id));
    };

    const confirmComplete = () =>
        Alert.alert('Complete trip?', 'This finishes the trip for this passenger.', [
            { text: 'Not yet', style: 'cancel' },
            { text: 'Complete', onPress: () => act(() => completeTrip(req.id)) },
        ]);

    const confirmCancelSeat = () => setCancelOpen(true);

    if (!isDriver) {
        return pickedUp ? (
            <Text style={styles.tripNote}>✓ Trip in progress. Enjoy the ride!</Text>
        ) : (
            <View>
                <View style={styles.pinCard}>
                    <Text style={styles.pinHint}>Tell your driver this PIN when you board (demo PIN check)</Text>
                    <Text style={styles.pinValue}>{req.pin ?? '----'}</Text>
                </View>
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.dangerBtn} onPress={confirmCancelSeat} disabled={busy}>
                        <Text style={styles.dangerBtnText}>Cancel trip</Text>
                    </TouchableOpacity>
                </View>
                <CancelTripModal
                    visible={cancelOpen}
                    busy={busy}
                    onKeep={() => setCancelOpen(false)}
                    onConfirm={async (reason) => {
                        setCancelOpen(false);
                        await act(() => cancelRequest(req.id, reason));
                    }}
                />
            </View>
        );
    }

    if (!pickedUp) {
        return (
            <View style={styles.actionsRow}>
                <TextInput
                    style={styles.pinInput}
                    placeholder="Passenger PIN"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={4}
                    value={pinInput}
                    onChangeText={setPinInput}
                />
                <TouchableOpacity
                    style={[styles.primaryBtn, pinInput.length < 4 && styles.btnDisabled]}
                    onPress={verify}
                    disabled={busy || pinInput.length < 4}
                >
                    <Text style={styles.primaryBtnText}>Verify & start</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View>
            <Text style={styles.tripNote}>✓ Passenger on board. Trip in progress.</Text>
            <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.primaryBtn} onPress={confirmComplete} disabled={busy}>
                    <Text style={styles.primaryBtnText}>Complete trip</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function Activity() {
    const router = useRouter();
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const tabBarHeight = useTabBarHeight();
    const { activeRide } = useAppNavigation();
    const { user } = useUser();
    const { eventTick, markAllRead } = useNotifications();
    const isDriver = user?.role === 'driver';

    const [tab, setTab] = useState<Tab>('offers');

    // A tapped notification sends us here with ?tab=all (and a changing "n")
    const { tab: tabParam, n: tabNonce } = useLocalSearchParams<{ tab?: string; n?: string }>();
    useEffect(() => {
        if (tabParam && TABS.some((t) => t.value === tabParam)) setTab(tabParam as Tab);
    }, [tabParam, tabNonce]);
    const [offers, setOffers] = useState<Ride[]>([]);
    const [history, setHistory] = useState<RequestWithPassenger[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        setRefreshing(true);
        try {
            const mine: Promise<RequestWithPassenger[]> = !user
                ? Promise.resolve([])
                : user.role === 'driver'
                    ? getRequestsForDriver(user.id)
                    : getRequestHistory(user.id);
            const [available, requests] = await Promise.all([searchRides(), mine]);
            setOffers(available);
            setHistory(requests);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
        setRefreshing(false);
    }, [user?.id, user?.role]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    // Opening this tab clears the red badge
    useFocusEffect(useCallback(() => { markAllRead(); }, [markAllRead]));

    // Something changed live (new request, accepted, cancelled...): reload the list
    useEffect(() => {
        if (eventTick > 0) load();
    }, [eventTick]);

    async function run(action: () => Promise<void>) {
        try {
            await action();
            load();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    }

    // One database step: checks it is still pending, takes the seat, marks it accepted
    const accept = (req: RequestWithPassenger) => run(() => approveRequest(req.id));

    const soon = (what: string) => Alert.alert('Coming soon', `${what} isn't connected yet.`);

    const statusPill = (status: string) => {
        switch (status) {
            case 'completed':
            case 'accepted':
                return { bg: colors.successSoft, fg: colors.success };
            case 'declined':
            case 'cancelled':
                return { bg: colors.dangerSoft, fg: colors.danger };
            default:
                return { bg: colors.accentSoft, fg: colors.accentText };
        }
    };

    // What the list shows depends on the selected tab
    const rows: Row[] =
        tab === 'offers'
            ? offers.map((ride): Row => ({ kind: 'offer', ride }))
            : history
                .filter((r) => r.ride_id)
                .filter((r) => tab === 'all' || r.status === 'completed')
                .map((req): Row => ({ kind: 'request', req }));

    const header = (
        <View>
            {activeRide && (
                <View style={styles.liveCard}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.liveLabel}>Live ride</Text>
                        <Text style={styles.pinText}>PIN · {activeRide.pin}</Text>
                    </View>
                    <Text style={styles.routeText}>{activeRide.origin}</Text>
                    <Text style={styles.routeArrow}>↓</Text>
                    <Text style={styles.routeText}>{activeRide.destination}</Text>

                    <View style={styles.divider} />

                    <View style={styles.rowBetween}>
                        <View style={styles.flexShrink}>
                            <Text style={styles.itemTitle}>
                                {activeRide.role === 'passenger' ? 'Driver' : 'Passenger'}: {activeRide.counterpart}
                            </Text>
                            <Text style={styles.itemSubtitle}>{activeRide.subtitle}</Text>
                        </View>
                        <Text style={styles.priceLarge}>P{activeRide.price.toFixed(0)}</Text>
                    </View>

                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[styles.primaryBtn, styles.grow2]}
                            onPress={() => router.navigate('/(tabs)' as any)}
                        >
                            <Text style={styles.primaryBtnText}>Track ride</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ghostBtn} onPress={() => soon('Calling')}>
                            <Text style={styles.ghostBtnText}>Call</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ghostBtn} onPress={() => soon('Chat')}>
                            <Text style={styles.ghostBtnText}>Chat</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <View style={styles.tabsRow}>
                {TABS.map((t) => {
                    const selected = t.value === tab;
                    return (
                        <TouchableOpacity
                            key={t.value}
                            style={[styles.tabItem, selected && styles.tabItemActive]}
                            onPress={() => setTab(t.value)}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                        >
                            <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{t.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <WireframeHeader title="Activity" subtitle="Your ride history" />

            <FlatList
                data={rows}
                keyExtractor={(row) => (row.kind === 'offer' ? row.ride.id : row.req.id)}
                refreshing={refreshing}
                onRefresh={load}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 16 }]}
                ListHeaderComponent={header}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {tab === 'offers' ? 'No rides available right now.' : 'No rides to show yet.'}
                    </Text>
                }
                renderItem={({ item }) => {
                    if (item.kind === 'offer') {
                        const { ride } = item;
                        return (
                            <TouchableOpacity
                                style={styles.card}
                                activeOpacity={0.8}
                                onPress={() => router.push(`/(tabs)/rides/${ride.id}` as any)}
                            >
                                <View style={styles.rowBetween}>
                                    <Text style={styles.cardTitle}>{formatWhen(ride.departure_time)}</Text>
                                    <View style={[styles.pill, { backgroundColor: colors.accentSoft }]}>
                                        <Text style={[styles.pillText, { color: colors.accentText }]}>
                                            {ride.seats_available} seat{ride.seats_available === 1 ? '' : 's'} left
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.coords}>{coord(ride.origin_lat, ride.origin_lng)}</Text>
                                <Text style={styles.coords}>↓ {coord(ride.destination_lat, ride.destination_lng)}</Text>
                            </TouchableOpacity>
                        );
                    }

                    const { req } = item;
                    const pill = statusPill(req.status);
                    return (
                        <View style={styles.card}>
                            <View style={styles.rowBetween}>
                                <Text style={styles.cardTitle}>
                                    {isDriver ? req.profiles?.full_name ?? 'Passenger' : 'Ride request'}
                                </Text>
                                <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                                    <Text style={[styles.pillText, { color: pill.fg }]}>{capitalise(req.status)}</Text>
                                </View>
                            </View>
                            <Text style={styles.coords}>
                                {req.seats_needed} seat{req.seats_needed === 1 ? '' : 's'} · {formatWhen(req.requested_time)}
                            </Text>
                            {req.status === 'cancelled' && !!req.cancelled_by && (
                                <Text style={styles.cancelledText}>
                                    {req.cancelled_by === 'driver'
                                        ? isDriver
                                            ? 'You cancelled this ride'
                                            : 'Cancelled by the driver'
                                        : isDriver
                                            ? 'Cancelled by the passenger'
                                            : 'You cancelled this request'}
                                    {req.cancelled_by === 'passenger' && !!req.cancel_reason
                                        ? ` · ${req.cancel_reason}`
                                        : ''}
                                </Text>
                            )}
                            {fareOf(req) !== null && (
                                <Text style={styles.fareText}>
                                    {isDriver ? 'Offers' : 'Your offer'} P{fareOf(req)!.toFixed(0)}
                                </Text>
                            )}

                            {req.status === 'pending' && isDriver && (
                                <View style={styles.actionsRow}>
                                    <TouchableOpacity style={styles.primaryBtn} onPress={() => accept(req)}>
                                        <Text style={styles.primaryBtnText}>Accept</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.dangerBtn}
                                        onPress={() => run(() => declineRequest(req.id))}
                                    >
                                        <Text style={styles.dangerBtnText}>Decline</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {req.status === 'accepted' && (
                                <TripActions req={req} isDriver={isDriver} onDone={load} />
                            )}

                            {req.status === 'pending' && !isDriver && (
                                <View style={styles.actionsRow}>
                                    <TouchableOpacity
                                        style={styles.dangerBtn}
                                        onPress={() => run(() => cancelRequest(req.id))}
                                    >
                                        <Text style={styles.dangerBtnText}>Cancel request</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                }}
            />
        </View>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: c.bg },
        listContent: { paddingHorizontal: 16, paddingTop: 16 },

        // Live ride card
        liveCard: {
            backgroundColor: c.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: c.border,
        },
        liveLabel: { color: c.accentText, fontSize: 12.5, fontWeight: '600' },
        pinText: { color: c.textMuted, fontSize: 12 },
        routeText: { color: c.textPrimary, fontSize: 15, fontWeight: '500', marginTop: 8 },
        routeArrow: { color: c.textMuted, fontSize: 13, marginTop: 2 },
        divider: { height: 1, backgroundColor: c.border, marginVertical: 12 },

        rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        flexShrink: { flex: 1, marginRight: 12 },
        itemTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
        itemSubtitle: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
        priceLarge: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },

        // Buttons
        actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
        grow2: { flex: 1.4 },
        primaryBtn: {
            flex: 1,
            backgroundColor: c.accent,
            borderRadius: 10,
            paddingVertical: 11,
            alignItems: 'center',
        },
        primaryBtnText: { color: c.onAccent, fontSize: 13.5, fontWeight: '600' },
        ghostBtn: {
            flex: 1,
            borderWidth: 1,
            borderColor: c.borderStrong,
            borderRadius: 10,
            paddingVertical: 11,
            alignItems: 'center',
        },
        ghostBtnText: { color: c.textSecondary, fontSize: 13.5, fontWeight: '500' },
        dangerBtn: {
            flex: 1,
            borderWidth: 1,
            borderColor: c.danger,
            backgroundColor: c.dangerSoft,
            borderRadius: 10,
            paddingVertical: 11,
            alignItems: 'center',
        },
        dangerBtnText: { color: c.danger, fontSize: 13.5, fontWeight: '600' },
        postBtn: { flex: 0, marginBottom: 18 },

        // Tabs
        tabsRow: {
            flexDirection: 'row',
            gap: 22,
            borderBottomWidth: 1,
            borderColor: c.border,
            marginBottom: 14,
        },
        tabItem: {
            paddingBottom: 10,
            borderBottomWidth: 2,
            borderBottomColor: 'transparent',
            marginBottom: -1,
        },
        tabItemActive: { borderBottomColor: c.accent },
        tabLabel: { color: c.textMuted, fontSize: 13.5, fontWeight: '600' },
        tabLabelActive: { color: c.textPrimary },

        // List cards
        card: {
            backgroundColor: c.surface,
            borderRadius: 14,
            padding: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: c.border,
        },
        cardTitle: { flex: 1, marginRight: 8, color: c.textPrimary, fontSize: 14.5, fontWeight: '600' },
        coords: { color: c.textSecondary, fontSize: 12.5, marginTop: 4 },
        cancelledText: { color: c.danger, fontSize: 12.5, fontWeight: '600', marginTop: 6 },
        fareText: { color: c.accentText, fontSize: 13.5, fontWeight: '700', marginTop: 6 },

        // Trip PIN / in-progress
        btnDisabled: { opacity: 0.5 },
        tripNote: { color: c.success, fontSize: 13, fontWeight: '600', marginTop: 10 },
        pinCard: {
            backgroundColor: c.accentSoft,
            borderRadius: 12,
            padding: 12,
            alignItems: 'center',
            marginTop: 12,
        },
        pinHint: { color: c.accentText, fontSize: 12.5, textAlign: 'center' },
        pinValue: { color: c.accentText, fontSize: 30, fontWeight: '700', letterSpacing: 8, marginTop: 6 },
        pinInput: {
            flex: 1,
            backgroundColor: c.inset,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.borderStrong,
            paddingHorizontal: 14,
            paddingVertical: 10,
            color: c.textPrimary,
            fontSize: 15,
            letterSpacing: 4,
        },
        pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
        pillText: { fontSize: 11, fontWeight: '600' },
        empty: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 32 },
    });