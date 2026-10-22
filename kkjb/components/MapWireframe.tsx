import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { useAppNavigation } from './NavigationContext';
import { Colors, useTheme, useThemedStyles } from './theme';
import { useTabBarHeight } from './layout';

interface MatchedDriver {
    id: string;
    name: string;
    initials: string;
    vehicle: string;
    seats: number;
    price: number;
    matchPercent: number;
    eta: string;
}

const PRESETS = [
    { label: 'UB Campus', address: 'University of Botswana, Main Campus' },
    { label: 'CBD iTowers', address: 'CBD Square, iTowers, Gaborone' },
    { label: 'Industrial Area', address: 'Gaborone Industrial Area, Station Rd' },
    { label: 'Game City', address: 'Game City Mall, Lobatse Rd' },
];

const MOCK_MATCHED_DRIVERS: MatchedDriver[] = [
    {
        id: 'offer-1',
        name: 'Kagiso Modise',
        initials: 'KM',
        vehicle: 'Silver Honda Fit',
        seats: 3,
        price: 12,
        matchPercent: 96,
        eta: 'Leaving in 4 min',
    },
    {
        id: 'offer-2',
        name: 'Thabo Khama',
        initials: 'TK',
        vehicle: 'White Toyota Corolla',
        seats: 2,
        price: 10,
        matchPercent: 91,
        eta: 'Leaving now',
    },
];

// Quick 4-digit PIN generator for the demo "live ride" card.
const generatePin = () => String(Math.floor(1000 + Math.random() * 9000));

export default function MapWireframe() {
    const { userRole, startRide } = useAppNavigation();
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const tabBarHeight = useTabBarHeight();
    const { height: windowHeight } = useWindowDimensions();

    // Passenger state
    const [destination, setDestination] = useState('');
    const [fareOffer, setFareOffer] = useState(12);
    const [passengerState, setPassengerState] = useState<'idle' | 'searching' | 'matched'>('idle');

    // Driver state
    const [driverDestination, setDriverDestination] = useState('Gaborone CBD / iTowers');
    const [seats, setSeats] = useState(3);
    const [driverPrice, setDriverPrice] = useState(12);
    const [driverState, setDriverState] = useState<'offline' | 'broadcasting' | 'requested'>('offline');

    const adjustFare = (amount: number) => {
        setFareOffer((prev) => Math.max(8, prev + amount));
    };
    const adjustDriverPrice = (amount: number) => {
        setDriverPrice((prev) => Math.max(8, prev + amount));
    };

    const handleFindRide = () => {
        if (!destination.trim()) return;
        setPassengerState('searching');
        setTimeout(() => setPassengerState('matched'), 1400);
    };
    const handleCancelSearch = () => setPassengerState('idle');
    const handleSearchAgain = () => {
        setDestination('');
        setPassengerState('idle');
    };

    // Booking a seat is what actually puts you "in a ride" - this is what
    // the Activity tab's Live ride card now keys off of.
    const handleRequestSeat = (driver: MatchedDriver) => {
        startRide({
            role: 'passenger',
            counterpart: driver.name,
            subtitle: driver.vehicle,
            origin: 'Your location',
            destination,
            price: driver.price,
            pin: generatePin(),
        });
        setPassengerState('idle');
        setDestination('');
    };

    const handleGoOnline = () => {
        setDriverState('broadcasting');
        setTimeout(() => setDriverState('requested'), 1600);
    };
    const handleStopBroadcast = () => setDriverState('offline');

    // Same idea for drivers: accepting a passenger starts the live ride,
    // declining just closes the request without one.
    const handleAcceptRequest = () => {
        startRide({
            role: 'driver',
            counterpart: 'Neo Molefe',
            subtitle: '1 seat · Along your route',
            origin: 'Your location',
            destination: driverDestination,
            price: driverPrice,
            pin: generatePin(),
        });
        setDriverState('offline');
    };
    const handleDeclineRequest = () => setDriverState('offline');

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Map area. (Placeholder - when the real map arrives, pass it
                `isDark` from useTheme() to pick a dark or light map style.) */}
            <View style={styles.mapArea}>
                <View style={[styles.roadLine, { top: '30%' }]} />
                <View style={[styles.roadLine, { top: '62%' }]} />

                <View style={styles.pickupPin}>
                    <View style={styles.pickupDot} />
                    <Text style={styles.pinLabel}>Your location</Text>
                </View>

                {userRole === 'passenger' && destination.trim().length > 0 && (
                    <View style={styles.dropoffPin}>
                        <View style={styles.dropoffDot} />
                        <Text style={styles.pinLabel} numberOfLines={1}>{destination}</Text>
                    </View>
                )}

                {/* Anchored to the bottom of the map, so the sheet can never
                    cover them - SOS stays reachable on every screen size. */}
                <View style={styles.mapControls}>
                    <TouchableOpacity style={styles.mapControlBtn} activeOpacity={0.8} accessibilityLabel="Centre on my location">
                        <Text style={styles.mapControlIcon}>◎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.mapControlBtn, styles.sosBtn]} activeOpacity={0.8} accessibilityLabel="SOS">
                        <Text style={styles.sosText}>SOS</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom sheet. It never grows taller than ~60% of the screen
                (it scrolls instead), and it leaves room at the bottom for
                the floating tab bar so no button is ever hidden behind it. */}
            <View style={[styles.sheet, { maxHeight: windowHeight * 0.62 }]}>
                <View style={styles.dragHandle} />

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: tabBarHeight + 12 }}
                >
                    {userRole === 'passenger' ? (
                        <>
                            {passengerState === 'idle' && (
                                <>
                                    <Text style={styles.sheetLabel}>Where are you headed?</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter destination"
                                        placeholderTextColor={colors.textMuted}
                                        value={destination}
                                        onChangeText={setDestination}
                                    />

                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.presetRow}
                                        contentContainerStyle={styles.presetContent}
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        {PRESETS.map((p) => (
                                            <TouchableOpacity
                                                key={p.label}
                                                style={styles.presetChip}
                                                onPress={() => setDestination(p.address)}
                                            >
                                                <Text style={styles.presetText}>{p.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    <View style={styles.fareRow}>
                                        <Text style={[styles.sheetLabel, styles.noMarginBottom]}>Your offer</Text>
                                        <View style={styles.stepper}>
                                            <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustFare(-1)} accessibilityLabel="Decrease offer">
                                                <Text style={styles.stepperBtnText}>−</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.stepperValue}>P{fareOffer.toFixed(0)}</Text>
                                            <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustFare(1)} accessibilityLabel="Increase offer">
                                                <Text style={styles.stepperBtnText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <TouchableOpacity style={styles.primaryBtn} onPress={handleFindRide}>
                                        <Text style={styles.primaryBtnText}>Find a ride</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {passengerState === 'searching' && (
                                <View style={styles.centerState}>
                                    <ActivityIndicator color={colors.accentText} />
                                    <Text style={styles.centerStateText}>Matching you with nearby drivers…</Text>
                                    <TouchableOpacity onPress={handleCancelSearch}>
                                        <Text style={styles.linkText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {passengerState === 'matched' && (
                                <>
                                    <Text style={styles.sheetLabel}>
                                        {MOCK_MATCHED_DRIVERS.length} drivers found near your route
                                    </Text>
                                    {MOCK_MATCHED_DRIVERS.map((d) => (
                                        <View key={d.id} style={styles.driverCard}>
                                            <View style={styles.rowBetween}>
                                                <View style={styles.flexShrink}>
                                                    <Text style={styles.itemTitle}>{d.name}</Text>
                                                    <Text style={styles.itemSubtitle}>{d.vehicle}</Text>
                                                </View>
                                                <Text style={styles.priceLarge}>P{d.price.toFixed(0)}</Text>
                                            </View>
                                            <View style={styles.rowBetween2}>
                                                <Text style={[styles.metaLine, styles.flexShrink]}>
                                                    {d.seats} seats · {d.eta}
                                                </Text>
                                                <Text style={styles.matchText}>{d.matchPercent}% match</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.requestBtn}
                                                onPress={() => handleRequestSeat(d)}
                                            >
                                                <Text style={styles.requestBtnText}>Request seat</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <TouchableOpacity onPress={handleSearchAgain}>
                                        <Text style={[styles.linkText, styles.searchAgain]}>
                                            Search again
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {driverState === 'offline' && (
                                <>
                                    <Text style={styles.sheetLabel}>Where are you heading?</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholderTextColor={colors.textMuted}
                                        value={driverDestination}
                                        onChangeText={setDriverDestination}
                                    />

                                    <View style={styles.fareRow}>
                                        <Text style={[styles.sheetLabel, styles.noMarginBottom]}>Seats available</Text>
                                        <View style={styles.stepper}>
                                            <TouchableOpacity
                                                style={styles.stepperBtn}
                                                onPress={() => setSeats((s) => Math.max(1, s - 1))}
                                                accessibilityLabel="Fewer seats"
                                            >
                                                <Text style={styles.stepperBtnText}>−</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.stepperValue}>{seats}</Text>
                                            <TouchableOpacity
                                                style={styles.stepperBtn}
                                                onPress={() => setSeats((s) => Math.min(4, s + 1))}
                                                accessibilityLabel="More seats"
                                            >
                                                <Text style={styles.stepperBtnText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.fareRow}>
                                        <Text style={[styles.sheetLabel, styles.noMarginBottom]}>Price per seat</Text>
                                        <View style={styles.stepper}>
                                            <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustDriverPrice(-1)} accessibilityLabel="Lower price">
                                                <Text style={styles.stepperBtnText}>−</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.stepperValue}>P{driverPrice.toFixed(0)}</Text>
                                            <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustDriverPrice(1)} accessibilityLabel="Raise price">
                                                <Text style={styles.stepperBtnText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <TouchableOpacity style={styles.primaryBtn} onPress={handleGoOnline}>
                                        <Text style={styles.primaryBtnText}>Go online</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {driverState === 'broadcasting' && (
                                <View style={styles.centerState}>
                                    <ActivityIndicator color={colors.accentText} />
                                    <Text style={styles.centerStateText}>Broadcasting your route to nearby passengers…</Text>
                                    <TouchableOpacity onPress={handleStopBroadcast}>
                                        <Text style={styles.linkText}>Stop</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {driverState === 'requested' && (
                                <View style={styles.driverCard}>
                                    <Text style={styles.sheetLabel}>New passenger request</Text>
                                    <View style={styles.rowBetween}>
                                        <View style={styles.flexShrink}>
                                            <Text style={styles.itemTitle}>Neo Molefe</Text>
                                            <Text style={styles.itemSubtitle}>1 seat · Along your route</Text>
                                        </View>
                                        <Text style={styles.priceLarge}>P{driverPrice.toFixed(0)}</Text>
                                    </View>
                                    <View style={styles.requestActions}>
                                        <TouchableOpacity style={styles.primaryBtnSmall} onPress={handleAcceptRequest}>
                                            <Text style={styles.primaryBtnText}>Accept</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.ghostBtnSmall} onPress={handleDeclineRequest}>
                                            <Text style={styles.ghostBtnText}>Decline</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: c.bg },

        mapArea: {
            flex: 1,
            backgroundColor: c.mapBg,
            overflow: 'hidden',
        },
        roadLine: {
            position: 'absolute',
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: c.borderStrong,
        },
        pickupPin: {
            position: 'absolute',
            left: '20%',
            top: '62%',
            alignItems: 'center',
        },
        pickupDot: {
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: c.accent,
            borderWidth: 3,
            borderColor: 'rgba(56,189,248,0.3)',
        },
        dropoffPin: {
            position: 'absolute',
            right: '18%',
            top: '28%',
            alignItems: 'center',
            maxWidth: 140,
        },
        dropoffDot: {
            width: 12,
            height: 12,
            borderRadius: 3,
            backgroundColor: c.danger,
        },
        pinLabel: {
            color: c.textSecondary,
            fontSize: 10.5,
            marginTop: 4,
            backgroundColor: c.mapLabelBg,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            overflow: 'hidden',
        },

        mapControls: {
            position: 'absolute',
            right: 16,
            bottom: 16,
            gap: 10,
        },
        mapControlBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: c.borderStrong,
        },
        mapControlIcon: { color: c.textPrimary, fontSize: 16 },
        sosBtn: { backgroundColor: c.dangerSoft, borderColor: c.danger },
        sosText: { color: c.danger, fontSize: 10, fontWeight: '700' },

        sheet: {
            backgroundColor: c.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            borderColor: c.borderStrong,
            paddingTop: 12,
            paddingHorizontal: 16,
            shadowColor: c.shadow,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 10,
            elevation: 10,
        },
        dragHandle: {
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: c.borderStrong,
            alignSelf: 'center',
            marginBottom: 14,
        },

        sheetLabel: { color: c.textSecondary, fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
        noMarginBottom: { marginBottom: 0 },
        input: {
            backgroundColor: c.inset,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: c.textPrimary,
            fontSize: 14,
            marginBottom: 14,
        },

        presetRow: { marginBottom: 16, marginHorizontal: -16 },
        presetContent: { paddingHorizontal: 16 },
        presetChip: {
            backgroundColor: c.inset,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
            marginRight: 8,
            borderWidth: 1,
            borderColor: c.border,
        },
        presetText: { color: c.textSecondary, fontSize: 12, fontWeight: '500' },

        fareRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
        stepperBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: c.inset,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: c.borderStrong,
        },
        stepperBtnText: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },
        stepperValue: { color: c.textPrimary, fontSize: 15, fontWeight: '600', minWidth: 36, textAlign: 'center' },

        primaryBtn: {
            backgroundColor: c.accent,
            borderRadius: 10,
            paddingVertical: 13,
            alignItems: 'center',
        },
        primaryBtnSmall: {
            flex: 1,
            backgroundColor: c.accent,
            borderRadius: 10,
            paddingVertical: 11,
            alignItems: 'center',
        },
        primaryBtnText: { color: c.onAccent, fontSize: 14, fontWeight: '600' },

        ghostBtnSmall: {
            flex: 1,
            borderRadius: 10,
            paddingVertical: 11,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: c.borderStrong,
        },
        ghostBtnText: { color: c.textSecondary, fontSize: 14, fontWeight: '500' },

        centerState: { alignItems: 'center', paddingVertical: 20, gap: 10 },
        centerStateText: { color: c.textSecondary, fontSize: 13, textAlign: 'center' },
        linkText: { color: c.accentText, fontSize: 13, fontWeight: '600' },
        searchAgain: { textAlign: 'center', marginTop: 4 },

        driverCard: {
            backgroundColor: c.inset,
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
        },
        rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
        rowBetween2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
        flexShrink: { flex: 1, marginRight: 12 },
        itemTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
        itemSubtitle: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
        metaLine: { color: c.textSecondary, fontSize: 11.5 },
        priceLarge: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },
        matchText: { color: c.success, fontSize: 11.5, fontWeight: '600' },

        requestBtn: {
            marginTop: 10,
            borderWidth: 1,
            borderColor: c.borderStrong,
            borderRadius: 8,
            paddingVertical: 8,
            alignItems: 'center',
        },
        requestBtnText: { color: c.accentText, fontSize: 12.5, fontWeight: '600' },
        requestActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
    });
