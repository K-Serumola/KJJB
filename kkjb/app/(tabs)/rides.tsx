import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import WireframeHeader from '../../components/WireframeHeader';
import { useAppNavigation } from '../../components/NavigationContext';
import { Colors, useTheme, useThemedStyles } from '../../components/theme';
import { useTabBarHeight } from '../../components/layout';

interface CarpoolMatchHistory {
    id: string;
    date: string;
    time: string;
    origin: string;
    destination: string;
    corridor: string;
    vehicle: string;
    driverOrPassenger: string;
    role: 'passenger' | 'driver';
    tokenPrice: string;
    combiSavings: string;
    matchAlgorithmScore: number;
    status: 'completed' | 'cancelled' | 'matched';
}

const GABORONE_RIDES_DATA: CarpoolMatchHistory[] = [
    {
        id: 'BW-9021',
        date: 'Today',
        time: '7:45 AM',
        origin: 'UB Notwane Gate',
        destination: 'Gaborone Industrial Area (Station Rd)',
        corridor: 'Kudumatse Drive',
        vehicle: 'Silver Honda Fit (B 482 BAX)',
        driverOrPassenger: 'Driver: Kagiso Modise',
        role: 'passenger',
        tokenPrice: 'P12.00',
        combiSavings: 'Saved 45 min wait vs 2 Combis',
        matchAlgorithmScore: 96,
        status: 'completed',
    },
    {
        id: 'BW-8874',
        date: 'Yesterday',
        time: '5:30 PM',
        origin: 'Gaborone CBD (iTowers)',
        destination: 'Block 8 Clinic / Western Bypass',
        corridor: 'Nelson Mandela Dr → Western Bypass',
        vehicle: 'White Toyota Corolla (B 119 BDF)',
        driverOrPassenger: 'Driver: Thabo Khama',
        role: 'passenger',
        tokenPrice: 'P10.00',
        combiSavings: 'Direct peer ride (Combi rate P10)',
        matchAlgorithmScore: 94,
        status: 'completed',
    },
    {
        id: 'BW-8650',
        date: 'Sep 14',
        time: '8:15 AM',
        origin: 'Broadhurst BBS Mall',
        destination: 'UB Main Campus',
        corridor: 'Mobuto Drive',
        vehicle: 'Offered 3 seats (Your Demio)',
        driverOrPassenger: 'Passengers: Neo M., Kabelo T., Lorato K.',
        role: 'driver',
        tokenPrice: '+ P30.00',
        combiSavings: 'Offset fuel cost by 65%',
        matchAlgorithmScore: 98,
        status: 'completed',
    },
    {
        id: 'BW-8412',
        date: 'Sep 12',
        time: '6:10 PM',
        origin: 'Game City Mall',
        destination: 'Tlokweng Border Road',
        corridor: 'Lobatse Rd → Tlokweng Main Rd',
        vehicle: 'Blue Mazda Demio (B 904 BCM)',
        driverOrPassenger: 'Driver: Lorato Phiri',
        role: 'passenger',
        tokenPrice: 'P15.00',
        combiSavings: 'Saved P35 vs Private Cab',
        matchAlgorithmScore: 89,
        status: 'completed',
    },
    {
        id: 'BW-8109',
        date: 'Sep 09',
        time: '1:20 PM',
        origin: 'Phakalane Acacia Mall',
        destination: 'Gaborone CBD',
        corridor: 'A1 North Highway',
        vehicle: 'Grey VW Polo (B 771 BHE)',
        driverOrPassenger: 'Driver: Tebogo S.',
        role: 'passenger',
        tokenPrice: 'P20.00',
        combiSavings: 'Direct express route',
        matchAlgorithmScore: 85,
        status: 'cancelled',
    },
];

export default function ActivityScreen() {
    const { activeRide } = useAppNavigation();
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const tabBarHeight = useTabBarHeight();

    const [selectedTab, setSelectedTab] = useState<'all' | 'completed' | 'offers'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const filteredRides = GABORONE_RIDES_DATA.filter((ride) => {
        if (selectedTab === 'completed' && ride.status !== 'completed') return false;
        if (selectedTab === 'offers' && ride.role !== 'driver') return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                ride.origin.toLowerCase().includes(query) ||
                ride.destination.toLowerCase().includes(query) ||
                ride.driverOrPassenger.toLowerCase().includes(query) ||
                ride.id.toLowerCase().includes(query) ||
                ride.corridor.toLowerCase().includes(query)
            );
        }
        return true;
    });

    // Colours for the little status pill (Completed / Cancelled / Matched).
    const badgeColors = (status: CarpoolMatchHistory['status']) => {
        if (status === 'cancelled') return { bg: colors.dangerSoft, text: colors.danger };
        if (status === 'matched') return { bg: colors.accentSoft, text: colors.accentText };
        return { bg: colors.successSoft, text: colors.success };
    };

    return (
        <View style={styles.container}>
            <WireframeHeader title="Activity" subtitle="Your ride history" />

            {/* The padding at the bottom equals the floating tab bar's height,
                so the last card can always be scrolled fully into view. */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 16 }]}
                showsVerticalScrollIndicator={false}
            >
                {activeRide && (
                    <View style={styles.activeCard}>
                        <View style={styles.rowBetween}>
                            <Text style={styles.liveLabel}>Live ride</Text>
                            <Text style={styles.pinText}>PIN · {activeRide.pin}</Text>
                        </View>

                        <View style={styles.routeBlock}>
                            <Text style={styles.routeTextLarge} numberOfLines={2}>{activeRide.origin}</Text>
                            <Text style={styles.routeArrow}>↓</Text>
                            <Text style={styles.routeTextLarge} numberOfLines={2}>{activeRide.destination}</Text>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.rowBetween}>
                            <View style={styles.flexShrink}>
                                <Text style={styles.itemTitle}>
                                    {activeRide.role === 'driver'
                                        ? `Passenger: ${activeRide.counterpart}`
                                        : `Driver: ${activeRide.counterpart}`}
                                </Text>
                                <Text style={styles.itemSubtitle}>{activeRide.subtitle}</Text>
                            </View>
                            <Text style={styles.priceLarge}>
                                {activeRide.role === 'driver' ? '+ ' : ''}P{activeRide.price.toFixed(0)}
                            </Text>
                        </View>

                        <View style={styles.activeActions}>
                            <TouchableOpacity style={styles.primaryBtn}>
                                <Text style={styles.primaryBtnText}>Track ride</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.ghostBtn}>
                                <Text style={styles.ghostBtnText}>Call</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.ghostBtn}>
                                <Text style={styles.ghostBtnText}>Chat</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={styles.controlsRow}>
                    {searchOpen ? (
                        <>
                            <TextInput
                                style={styles.searchInlineInput}
                                placeholder="Search rides"
                                placeholderTextColor={colors.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                            />
                            <TouchableOpacity
                                onPress={() => {
                                    setSearchOpen(false);
                                    setSearchQuery('');
                                }}
                                hitSlop={8}
                                accessibilityLabel="Close search"
                            >
                                <Text style={styles.searchCloseIcon}>✕</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <View style={styles.tabGroup}>
                                {(['all', 'completed', 'offers'] as const).map((tab) => (
                                    <TouchableOpacity
                                        key={tab}
                                        style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
                                        onPress={() => setSelectedTab(tab)}
                                    >
                                        <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                                            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TouchableOpacity
                                style={styles.searchToggleBtn}
                                onPress={() => setSearchOpen(true)}
                                hitSlop={8}
                                accessibilityLabel="Search rides"
                            >
                                <Text style={styles.searchToggleIcon}>🔍</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {filteredRides.length === 0 && (
                    <Text style={styles.emptyText}>No rides match that yet.</Text>
                )}

                {filteredRides.map((ride) => {
                    const expanded = expandedId === ride.id;
                    const badge = badgeColors(ride.status);
                    return (
                        <TouchableOpacity
                            key={ride.id}
                            style={styles.rideCard}
                            activeOpacity={0.8}
                            onPress={() => setExpandedId(expanded ? null : ride.id)}
                        >
                            {/* Row 1: where to / where from, and the price */}
                            <View style={styles.rowBetween}>
                                <View style={styles.flexShrink}>
                                    <Text style={styles.itemTitle} numberOfLines={2}>{ride.origin}</Text>
                                    <Text style={styles.itemSubtitle} numberOfLines={2}>↓ {ride.destination}</Text>
                                </View>
                                <Text style={styles.priceLarge}>{ride.tokenPrice}</Text>
                            </View>

                            {/* Row 2: when, and the status pill */}
                            <View style={styles.rowBetween2}>
                                <Text style={[styles.metaLine, styles.flexShrink]}>
                                    {ride.date} · {ride.time}
                                </Text>
                                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                                    <Text style={[styles.badgeText, { color: badge.text }]}>{ride.status}</Text>
                                </View>
                            </View>

                            {/* Row 3: who. Gets its own full-width line, so
                                long passenger lists wrap instead of spilling. */}
                            <Text style={styles.whoLine}>{ride.driverOrPassenger}</Text>

                            {expanded && (
                                <View style={styles.expandedBlock}>
                                    <View style={styles.divider} />
                                    <Text style={styles.expandedLine}>Via {ride.corridor}</Text>
                                    <Text style={styles.expandedLine}>{ride.vehicle}</Text>
                                    <Text style={styles.expandedLine}>
                                        {ride.matchAlgorithmScore}% route match · {ride.combiSavings}
                                    </Text>
                                    <TouchableOpacity style={styles.rebookBtn}>
                                        <Text style={styles.rebookText}>Match again</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: c.bg },
        scroll: { flex: 1 },
        scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

        activeCard: {
            backgroundColor: c.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: c.border,
        },
        liveLabel: { color: c.accentText, fontSize: 12, fontWeight: '600' },
        pinText: { color: c.textMuted, fontSize: 12 },
        routeBlock: { marginVertical: 12 },
        routeTextLarge: { color: c.textPrimary, fontSize: 15, fontWeight: '500' },
        routeArrow: { color: c.textMuted, fontSize: 12, marginVertical: 2 },
        priceLarge: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },
        activeActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
        primaryBtn: {
            flex: 2,
            backgroundColor: c.accent,
            borderRadius: 8,
            paddingVertical: 10,
            alignItems: 'center',
        },
        primaryBtnText: { color: c.onAccent, fontSize: 13, fontWeight: '600' },
        ghostBtn: {
            flex: 1,
            borderRadius: 8,
            paddingVertical: 10,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: c.borderStrong,
        },
        ghostBtnText: { color: c.textSecondary, fontSize: 13, fontWeight: '500' },

        controlsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
            paddingBottom: 2,
        },
        tabGroup: { flexDirection: 'row', flex: 1 },
        tabButton: { paddingVertical: 8, marginRight: 20 },
        tabButtonActive: { borderBottomWidth: 2, borderBottomColor: c.accent },
        tabText: { color: c.textMuted, fontSize: 13, fontWeight: '500' },
        tabTextActive: { color: c.textPrimary },

        searchToggleBtn: {
            width: 30,
            height: 30,
            alignItems: 'center',
            justifyContent: 'center',
        },
        searchToggleIcon: { fontSize: 14 },
        searchInlineInput: {
            flex: 1,
            color: c.textPrimary,
            paddingVertical: 8,
            fontSize: 14,
        },
        searchCloseIcon: { color: c.textMuted, fontSize: 14, paddingLeft: 8 },

        emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', marginTop: 24 },

        rideCard: {
            backgroundColor: c.surface,
            borderRadius: 14,
            padding: 14,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: c.border,
        },
        rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
        rowBetween2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
        flexShrink: { flex: 1, marginRight: 12 },
        itemTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
        itemSubtitle: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
        metaLine: { color: c.textSecondary, fontSize: 11.5 },
        whoLine: { color: c.textSecondary, fontSize: 11.5, marginTop: 4, lineHeight: 16 },

        badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
        badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },

        expandedBlock: { marginTop: 8 },
        expandedLine: { color: c.textSecondary, fontSize: 11.5, marginTop: 4, lineHeight: 16 },
        divider: { height: 1, backgroundColor: c.border, marginVertical: 10 },
        rebookBtn: {
            marginTop: 10,
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: c.borderStrong,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
        },
        rebookText: { color: c.accentText, fontSize: 12, fontWeight: '600' },
    });
