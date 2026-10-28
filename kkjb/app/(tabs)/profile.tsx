import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import WireframeHeader from '../../components/WireframeHeader';
import SegmentedControl from '../../components/SegmentedControl';
import { useAppNavigation } from '../../components/NavigationContext';
import { Colors, ThemeMode, useTheme, useThemedStyles } from '../../components/theme';
import { useTabBarHeight } from '../../components/layout';
import { useUser } from '../../components/UserContext';
import { switchRole } from '../../services/profileService';
import { getMyActiveRide } from '../../services/rideService';
import { getMyOpenRequest } from '../../services/requestService';

// Payment methods that actually exist in Botswana: mobile money, FNB eWallet
// and cash. (No in-app bank cards - people here mostly don't pay that way.)
const PAYMENT_METHODS = [
    { id: 'orange', name: 'Orange Money', detail: 'Default · +267 74 ••• 892', dot: '#F97316' },
    { id: 'myzaka', name: 'Mascom MyZaka', detail: '+267 71 ••• 410', dot: '#22C55E' },
    { id: 'fnb', name: 'FNB eWallet', detail: '+267 72 ••• 305', dot: '#14B8A6' },
    { id: 'cash', name: 'Cash to driver', detail: 'Pay in Pula on boarding', dot: null },
];

export default function ProfileScreen() {

    const { endRide } = useAppNavigation();
    const { colors, mode, setMode } = useTheme();
    const styles = useThemedStyles(createStyles);
    const tabBarHeight = useTabBarHeight();
    const router = useRouter();
    const { user, refreshProfile } = useUser();
    const isDriverMode = user?.role === 'driver';

    const [pinVerification, setPinVerification] = useState(true);
    const [notifications, setNotifications] = useState(true);

    // The switch is locked while you have a ride posted (driver) or a request open (passenger)
    const [lockReason, setLockReason] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            let alive = true;
            (async () => {
                if (!user) return;
                try {
                    if (user.role === 'driver') {
                        const ride = await getMyActiveRide(user.id);
                        if (alive) setLockReason(ride ? 'Finish or cancel your posted ride to switch to passenger mode.' : null);
                    } else {
                        const req = await getMyOpenRequest(user.id);
                        if (alive) setLockReason(req ? 'Finish or cancel your open request to switch to driver mode.' : null);
                    }
                } catch {
                    if (alive) setLockReason(null);
                }
            })();
            return () => {
                alive = false;
            };
        }, [user?.id, user?.role]),
    );

    const handleToggleDriverMode = async () => {
        if (!user || lockReason) return;
        try {
            await switchRole(user.id);   // saves to Supabase
            await refreshProfile();      // every screen updates
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    // The ONE place to log out. Ends the Supabase session, clears the demo
    // ride/role, then goes back to the login screen (replace = you can't
    // swipe back into the app).
    const handleLogout = async () => {
        await supabase.auth.signOut();
        endRide();
        router.replace('/(auth)/login' as any);
    };

    const switchColors = { false: colors.switchOff, true: colors.accent };

    return (
        <View style={styles.container}>
            <WireframeHeader title="Profile" subtitle="Account and settings" />

            {/* Bottom padding = the floating tab bar's height, so Log out and
                the version line can scroll fully clear of it. */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 16 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.userRow}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{user?.initials}</Text>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user?.fullName}</Text>
                        <Text style={styles.userEmail}>{user?.email}</Text>
                        <Text style={styles.userMeta}>
                            <Text style={styles.starIcon}>★ </Text>
                            {user?.rating} · demo rating
                        </Text>
                    </View>
                </View>

                {/* Driver mode */}
                <View style={styles.card}>
                    <View style={styles.rowBetween}>
                        <View style={styles.flexShrink}>
                            <Text style={styles.rowTitle}>
                                {isDriverMode ? 'Driver mode' : 'Switch to driver mode'}
                            </Text>
                            <Text style={styles.rowSubtitle}>
                                {isDriverMode
                                    ? 'Sharing seats on your daily route'
                                    : 'Offer seats and offset fuel costs'}
                            </Text>
                            {lockReason && <Text style={styles.lockNote}>{lockReason}</Text>}
                        </View>
                        <Switch
                            value={isDriverMode}
                            disabled={!!lockReason}
                            onValueChange={handleToggleDriverMode}
                            trackColor={switchColors}
                            thumbColor={colors.switchThumb}
                        />
                    </View>

                    {isDriverMode && (
                        <>
                            <View style={styles.divider} />
                            <Text style={styles.metaLine}>P360.00 earned · 18 rides · 88% seat fill (demo data)</Text>
                            <View style={[styles.rowBetween, styles.topGap]}>
                                <Text style={[styles.metaLine, styles.flexShrink]}>2016 Honda Fit · B 482 BAX</Text>
                                <TouchableOpacity>
                                    <Text style={styles.linkText}>Edit</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>

                {/* Payment methods (demo: payments aren't connected yet) */}
                <Text style={styles.sectionLabel}>Payment methods</Text>
                <View style={styles.card}>
                    {PAYMENT_METHODS.map((method) => (
                        <TouchableOpacity key={method.id} style={styles.listRow}>
                            <View style={[styles.dot, { backgroundColor: method.dot ?? colors.textMuted }]} />
                            <View style={styles.flexGrow}>
                                <Text style={styles.itemTitle}>{method.name}</Text>
                                <Text style={styles.itemSubtitle}>{method.detail}</Text>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                    ))}
                    <Text style={styles.demoNote}>Demo only. Payments aren't connected yet.</Text>
                </View>

                {/* Preferences */}
                <Text style={styles.sectionLabel}>Preferences</Text>
                <View style={styles.card}>
                    <View style={styles.switchRow}>
                        <View style={styles.flexShrink}>
                            <Text style={styles.itemTitle}>PIN ride verification</Text>
                            <Text style={styles.itemSubtitle}>Confirm identity before boarding (demo)</Text>
                        </View>
                        <Switch
                            value={pinVerification}
                            onValueChange={setPinVerification}
                            trackColor={switchColors}
                            thumbColor={colors.switchThumb}
                        />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.switchRow}>
                        <View style={styles.flexShrink}>
                            <Text style={styles.itemTitle}>Trip notifications</Text>
                            <Text style={styles.itemSubtitle}>Driver proximity and match alerts (demo)</Text>
                        </View>
                        <Switch
                            value={notifications}
                            onValueChange={setNotifications}
                            trackColor={switchColors}
                            thumbColor={colors.switchThumb}
                        />
                    </View>

                    <View style={styles.divider} />

                    {/* App-wide theme: replaces the old "Dark map theme" switch. */}
                    <Text style={styles.itemTitle}>Appearance</Text>
                    <Text style={styles.itemSubtitle}>Applies to the whole app, map included</Text>
                    <View style={styles.segmentGap}>
                        <SegmentedControl<ThemeMode>
                            options={[
                                { value: 'light', label: 'Light' },
                                { value: 'dark', label: 'Dark' },
                            ]}
                            value={mode}
                            onChange={setMode}
                        />
                    </View>
                </View>

                {/* The only Log out button in the app. */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                    <Text style={styles.logoutText}>Log out</Text>
                </TouchableOpacity>
                <Text style={styles.versionText}>Version 1.0.0</Text>
            </ScrollView>
        </View>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: c.bg },
        scroll: { flex: 1 },
        scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

        userRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
            gap: 14,
        },
        avatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarText: { color: c.onAccent, fontSize: 16, fontWeight: '600' },
        userInfo: { flex: 1 },
        userName: { color: c.textPrimary, fontSize: 17, fontWeight: '600' },
        userEmail: { color: c.textSecondary, fontSize: 12.5, marginTop: 1 },
        userMeta: { color: c.textSecondary, fontSize: 12, marginTop: 4 },
        starIcon: { color: c.star },
        verifiedText: { color: c.success },

        card: {
            backgroundColor: c.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: c.border,
        },
        divider: {
            height: 1,
            backgroundColor: c.border,
            marginVertical: 12,
        },
        rowBetween: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        switchRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        flexShrink: { flex: 1, marginRight: 12 },
        flexGrow: { flex: 1 },
        topGap: { marginTop: 8 },
        segmentGap: { marginTop: 12 },

        rowTitle: { color: c.textPrimary, fontSize: 14.5, fontWeight: '600' },
        rowSubtitle: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
        lockNote: { color: c.danger, fontSize: 11.5, marginTop: 4 },
        metaLine: { color: c.textSecondary, fontSize: 12.5, marginTop: 2 },
        linkText: { color: c.accentText, fontSize: 12.5, fontWeight: '600' },

        sectionLabel: {
            color: c.textMuted,
            fontSize: 11.5,
            fontWeight: '600',
            marginBottom: 8,
            marginLeft: 2,
        },

        demoNote: { color: c.textMuted, fontSize: 11.5, marginTop: 8 },

        listRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 9,
            gap: 10,
        },
        dot: { width: 8, height: 8, borderRadius: 4 },
        itemTitle: { color: c.textPrimary, fontSize: 13.5, fontWeight: '500' },
        itemSubtitle: { color: c.textMuted, fontSize: 11.5, marginTop: 1 },
        chevron: { color: c.textMuted, fontSize: 16 },

        logoutBtn: {
            alignItems: 'center',
            paddingVertical: 13,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.danger,
            backgroundColor: c.dangerSoft,
            marginTop: 4,
            marginBottom: 12,
        },
        logoutText: { color: c.danger, fontSize: 14, fontWeight: '600' },
        versionText: {
            color: c.textMuted,
            fontSize: 10.5,
            textAlign: 'center',
        },
    });
