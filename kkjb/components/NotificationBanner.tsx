import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, useThemedStyles } from './theme';
import { useScreenInsets } from './layout';
import { useNotifications } from './NotificationContext';
import { approveRequest, declineRequest } from '../services/requestService';

// The little card that slides in at the top when something happens.
//  - Tap it to open Activity on the Requests tab (where the request card lives).
//  - A driver's "New ride request" also has Accept / Decline buttons right on it.
// It hides itself after a few seconds.
export default function NotificationBanner() {
    const { banner, dismissBanner, refresh } = useNotifications();
    const styles = useThemedStyles(createStyles);
    const insets = useScreenInsets();
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    if (!banner) return null;

    const openActivity = () => {
        dismissBanner();
        // "n" changes every time so the Activity screen notices even if you were already there
        router.navigate({
            pathname: '/(tabs)/rides',
            params: { tab: 'all', n: String(Date.now()) },
        } as any);
    };

    const answer = async (accept: boolean) => {
        const req = banner.request;
        if (!req || busy) return;
        setBusy(true);
        try {
            if (accept) await approveRequest(req.id);
            else await declineRequest(req.id);
            dismissBanner();
            refresh(); // reload the lists and the ride panel
        } catch (e: any) {
            Alert.alert(accept ? 'Could not accept' : 'Could not decline', e.message);
            dismissBanner();
            refresh();
        }
        setBusy(false);
    };

    return (
        <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
            <View style={styles.card} accessibilityRole="alert">
                <TouchableOpacity style={styles.topRow} activeOpacity={0.8} onPress={openActivity}>
                    <View style={styles.dot} />
                    <View style={styles.textCol}>
                        <Text style={styles.title} numberOfLines={1}>{banner.title}</Text>
                        <Text style={styles.body} numberOfLines={3}>{banner.body}</Text>
                    </View>
                    <TouchableOpacity onPress={dismissBanner} hitSlop={12} accessibilityLabel="Dismiss">
                        <Text style={styles.close}>✕</Text>
                    </TouchableOpacity>
                </TouchableOpacity>

                {banner.request && (
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.acceptBtn, busy && styles.disabled]}
                            onPress={() => answer(true)}
                            disabled={busy}
                        >
                            <Text style={styles.acceptText}>{busy ? 'Please wait…' : 'Accept'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.declineBtn, busy && styles.disabled]}
                            onPress={() => answer(false)}
                            disabled={busy}
                        >
                            <Text style={styles.declineText}>Decline</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        wrap: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 20 },
        card: {
            backgroundColor: c.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.accent,
            paddingVertical: 12,
            paddingHorizontal: 14,
            shadowColor: c.shadow,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 12,
        },
        topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
        textCol: { flex: 1 },
        title: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
        body: { color: c.textSecondary, fontSize: 12.5, marginTop: 2 },
        close: { color: c.textMuted, fontSize: 16 },

        actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
        acceptBtn: {
            flex: 1,
            backgroundColor: c.accent,
            borderRadius: 10,
            paddingVertical: 10,
            alignItems: 'center',
        },
        acceptText: { color: c.onAccent, fontSize: 13.5, fontWeight: '600' },
        declineBtn: {
            flex: 1,
            borderWidth: 1,
            borderColor: c.danger,
            backgroundColor: c.dangerSoft,
            borderRadius: 10,
            paddingVertical: 10,
            alignItems: 'center',
        },
        declineText: { color: c.danger, fontSize: 13.5, fontWeight: '600' },
        disabled: { opacity: 0.5 },
    });
