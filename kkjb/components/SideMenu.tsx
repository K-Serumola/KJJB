import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppNavigation } from './NavigationContext';
import { Colors, useThemedStyles } from './theme';
import { DRAWER_FEATURES } from './drawerFeatures';
import { MOCK_USER } from './mockData';

/*
 * The side menu only holds things you can't find anywhere else in the app:
 *   - My regular routes, Intercity, Trusted contacts, Invite, Help
 * Drive / Activity / Account live in the bottom tabs, and wallet, PIN,
 * appearance and Log out live in Account - so none of that is repeated here.
 * The list of features is in components/drawerFeatures.ts.
 */

function DrawerContent() {
    const { closeSideMenu } = useAppNavigation();
    const router = useRouter();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();

    // 82% of the screen, but never wider than 330 (so it looks right on
    // phones AND tablets). useWindowDimensions updates if the screen changes.
    const menuWidth = Math.min(width * 0.82, 330);

    const go = (path: string) => {
        closeSideMenu();
        router.push(path as any);
    };

    return (
        <View style={styles.overlay}>
            <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={closeSideMenu}
                accessibilityLabel="Close menu"
            />

            <View style={[styles.drawer, { width: menuWidth }]}>
                <View style={[styles.profileHeader, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity
                        style={styles.profileTap}
                        onPress={() => go('/(tabs)/profile')}
                        activeOpacity={0.8}
                        accessibilityLabel="Open profile"
                    >
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarText}>{MOCK_USER.initials}</Text>
                        </View>
                        <View style={styles.flexGrow}>
                            <Text style={styles.userName} numberOfLines={1}>{MOCK_USER.name}</Text>
                            <Text style={styles.userMeta} numberOfLines={1}>
                                ★ {MOCK_USER.rating} · View profile ›
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={closeSideMenu} hitSlop={10} accessibilityLabel="Close menu">
                        <Text style={styles.closeIcon}>✕</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.menuScroll}
                    contentContainerStyle={styles.menuContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.sectionHeader}>MORE</Text>
                    {DRAWER_FEATURES.map((f) => (
                        <TouchableOpacity
                            key={f.slug}
                            style={styles.featureItem}
                            onPress={() => go(`/feature/${f.slug}`)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.iconChip}>
                                <Text style={styles.iconText}>{f.icon}</Text>
                            </View>
                            <View style={styles.flexGrow}>
                                <Text style={styles.featureLabel}>{f.title}</Text>
                                <Text style={styles.featureNote}>{f.note}</Text>
                            </View>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
                    <Text style={styles.versionText}>RideShare Botswana · Gaborone MVP</Text>
                </View>
            </View>
        </View>
    );
}

export default function SideMenu() {
    const { isSideMenuOpen, closeSideMenu } = useAppNavigation();

    return (
        <Modal
            visible={isSideMenuOpen}
            animationType="fade"
            transparent={true}
            statusBarTranslucent
            onRequestClose={closeSideMenu}
        >
            {/* A modal is its own little window, so it needs its own
                SafeAreaProvider to know where the notch is. */}
            <SafeAreaProvider>
                <DrawerContent />
            </SafeAreaProvider>
        </Modal>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: c.overlay,
        },
        drawer: {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            backgroundColor: c.bg,
            borderRightWidth: 1,
            borderColor: c.borderStrong,
            flexDirection: 'column',
        },

        profileHeader: {
            paddingHorizontal: 16,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderColor: c.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        profileTap: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        avatarCircle: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
        closeIcon: { color: c.textMuted, fontSize: 18, padding: 4 },
        userName: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },
        userMeta: { color: c.textSecondary, fontSize: 12, marginTop: 2 },

        menuScroll: { flex: 1 },
        menuContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },

        sectionHeader: {
            color: c.textMuted,
            fontSize: 10.5,
            fontWeight: '700',
            letterSpacing: 0.6,
            marginBottom: 6,
            paddingLeft: 4,
        },

        featureItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 10,
            paddingHorizontal: 4,
        },
        iconChip: {
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        iconText: { fontSize: 17 },
        flexGrow: { flex: 1 },
        featureLabel: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
        featureNote: { color: c.textMuted, fontSize: 11.5, marginTop: 1 },
        chevron: { color: c.textMuted, fontSize: 18 },

        footer: {
            paddingTop: 12,
            paddingHorizontal: 16,
            borderTopWidth: 1,
            borderColor: c.border,
            alignItems: 'center',
        },
        versionText: { color: c.textMuted, fontSize: 10.5 },
    });
