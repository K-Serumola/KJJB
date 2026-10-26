import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView from 'react-native-maps';
import { useAppNavigation } from './NavigationContext';
import { Colors, useThemedStyles } from './theme';
import { useTabBarHeight } from './layout';
import { useMyLocation } from './useMyLocation';
import ThemedMap from './ThemedMap';

/*
 * IN-RIDE SCREEN - what you see once you're in a ride.
 *
 * It reads `activeRide` from NavigationContext (set by startRide). Nothing
 * calls startRide any more (rides are posted and requested for real now),
 * so this screen is currently unreachable demo code.
 */

export default function InRideView() {
    const { activeRide, endRide } = useAppNavigation();
    const styles = useThemedStyles(createStyles);
    const tabBarHeight = useTabBarHeight();
    const { coords, error } = useMyLocation();
    const mapRef = useRef<MapView>(null);
    const [following, setFollowing] = useState(true);

    // Every new GPS fix: slide the map to you (unless you dragged it away)
    useEffect(() => {
        if (coords && following) {
            mapRef.current?.animateToRegion(
                { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 },
                600,
            );
        }
    }, [coords, following]);

    // All hooks are above this line, so returning early is safe
    if (!activeRide) return null;

    const isPassenger = activeRide.role === 'passenger';
    const initials = activeRide.counterpart
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');

    const confirmEnd = () =>
        Alert.alert('End ride?', 'This finishes the trip.', [
            { text: 'Keep riding', style: 'cancel' },
            { text: 'End ride', style: 'destructive', onPress: endRide },
        ]);

    const onSos = () =>
        Alert.alert('SOS', 'Not connected yet. Later this will alert your trusted contacts.');

    return (
        <View style={styles.container}>
            <View style={styles.mapArea}>
                <ThemedMap ref={mapRef} onPanDrag={() => setFollowing(false)} />

                {error ? (
                    <View style={styles.banner}>
                        <Text style={styles.bannerText}>{error}. Turn it on in your phone settings.</Text>
                    </View>
                ) : null}

                <View style={styles.mapControls}>
                    <TouchableOpacity
                        style={styles.mapControlBtn}
                        onPress={() => setFollowing(true)}
                        activeOpacity={0.8}
                        accessibilityLabel="Centre on my location"
                    >
                        <Text style={styles.mapControlIcon}>◎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.mapControlBtn, styles.sosBtn]}
                        onPress={onSos}
                        activeOpacity={0.8}
                        accessibilityLabel="SOS"
                    >
                        <Text style={styles.sosText}>SOS</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.sheet, { paddingBottom: tabBarHeight + 12 }]}>
                <View style={styles.dragHandle} />

                <Text style={styles.status}>{isPassenger ? 'Your ride is on the way' : 'Ride in progress'}</Text>

                <View style={styles.personRow}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={styles.flexGrow}>
                        <Text style={styles.personName}>{activeRide.counterpart}</Text>
                        <Text style={styles.personSub}>{activeRide.subtitle}</Text>
                    </View>
                    <Text style={styles.price}>P{activeRide.price.toFixed(0)}</Text>
                </View>

                <View style={styles.routeCard}>
                    <View style={styles.routeRow}>
                        <View style={styles.originDot} />
                        <Text style={styles.routeText} numberOfLines={1}>{activeRide.origin}</Text>
                    </View>
                    <View style={styles.routeRow}>
                        <View style={styles.destDot} />
                        <Text style={styles.routeText} numberOfLines={1}>{activeRide.destination}</Text>
                    </View>
                </View>

                {isPassenger ? (
                    <View style={styles.pinCard}>
                        <Text style={styles.pinHint}>Tell your driver this PIN when you board</Text>
                        <Text style={styles.pinValue}>{activeRide.pin}</Text>
                    </View>
                ) : (
                    <View style={styles.pinCard}>
                        <Text style={styles.pinHint}>
                            Ask {activeRide.counterpart} for their 4-digit PIN before you set off
                        </Text>
                    </View>
                )}

                <TouchableOpacity style={styles.endBtn} onPress={confirmEnd} activeOpacity={0.8}>
                    <Text style={styles.endBtnText}>End ride</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: c.bg },
        mapArea: { flex: 1, backgroundColor: c.mapBg, overflow: 'hidden' },

        banner: {
            position: 'absolute',
            left: 16,
            right: 72,
            bottom: 16,
            backgroundColor: c.mapLabelBg,
            borderRadius: 10,
            padding: 10,
        },
        bannerText: { color: c.danger, fontSize: 12 },

        mapControls: { position: 'absolute', right: 16, bottom: 16, gap: 10 },
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
        status: { color: c.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 14 },

        personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
        avatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
        flexGrow: { flex: 1 },
        personName: { color: c.textPrimary, fontSize: 14.5, fontWeight: '600' },
        personSub: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
        price: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },

        routeCard: {
            backgroundColor: c.inset,
            borderRadius: 12,
            padding: 12,
            gap: 10,
            marginBottom: 12,
        },
        routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        originDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
        destDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: c.danger },
        routeText: { flex: 1, color: c.textPrimary, fontSize: 13 },

        pinCard: {
            backgroundColor: c.accentSoft,
            borderRadius: 12,
            padding: 12,
            alignItems: 'center',
            marginBottom: 14,
        },
        pinHint: { color: c.accentText, fontSize: 12.5, textAlign: 'center' },
        pinValue: {
            color: c.accentText,
            fontSize: 30,
            fontWeight: '700',
            letterSpacing: 8,
            marginTop: 6,
        },

        endBtn: {
            alignItems: 'center',
            paddingVertical: 13,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.danger,
            backgroundColor: c.dangerSoft,
        },
        endBtnText: { color: c.danger, fontSize: 14, fontWeight: '600' },
    });