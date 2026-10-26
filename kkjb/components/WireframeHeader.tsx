import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppNavigation } from './NavigationContext';
import { Colors, useThemedStyles } from './theme';
import { useScreenInsets } from './layout';
import { useUser } from './UserContext';

interface WireframeHeaderProps {
    title: string;
    subtitle?: string;
    showBackButton?: boolean;
    floating?: boolean;
}

export default function WireframeHeader({
    title,
    subtitle,
    showBackButton,
    floating = false,
}: WireframeHeaderProps) {
    const { openSideMenu } = useAppNavigation();
    const router = useRouter();
    const styles = useThemedStyles(createStyles);
    const insets = useScreenInsets();
    const { user } = useUser();

    if (floating) {
        return (
            <View
                style={[styles.floatingHeader, { top: insets.top + 8 }]}
                pointerEvents="box-none"
            >
                <TouchableOpacity
                    style={styles.floatingButton}
                    onPress={openSideMenu}
                    accessibilityLabel="Open menu"
                    activeOpacity={0.8}
                >
                    <Text style={styles.floatingMenuIcon}>☰</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.floatingAvatar}
                    onPress={() => router.push('/(tabs)/profile' as any)}
                    activeOpacity={0.8}
                    accessibilityLabel="Open account"
                >
                    <Text style={styles.avatarText}>{user?.initials}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <View style={styles.topRow}>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={showBackButton ? () => router.back() : openSideMenu}
                    activeOpacity={0.8}
                    accessibilityLabel={showBackButton ? 'Go back' : 'Open menu'}
                >
                    <Text style={styles.headerIcon}>{showBackButton ? '‹' : '☰'}</Text>
                </TouchableOpacity>

                <View style={styles.titleContainer}>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                    {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
                </View>

                {/* Balances the menu/back button so the title stays centered */}
                <View style={styles.headerSpacer} />
            </View>
        </View>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        floatingHeader: {
            position: 'absolute',
            left: 16,
            right: 16,
            zIndex: 100,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        floatingButton: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.surface,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: c.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 6,
            borderWidth: 1,
            borderColor: c.borderStrong,
        },
        floatingMenuIcon: {
            color: c.textPrimary,
            fontSize: 18,
            fontWeight: '700',
        },
        floatingAvatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.accent,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: c.accentText,
            shadowColor: c.shadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            elevation: 5,
        },
        avatarText: {
            color: c.onAccent,
            fontSize: 13,
            fontWeight: '700',
        },
        header: {
            backgroundColor: c.bg,
            paddingBottom: 14,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderColor: c.border,
        },
        topRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        iconButton: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: c.surface,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: c.borderStrong,
        },
        headerIcon: {
            color: c.textPrimary,
            fontSize: 18,
            fontWeight: '600',
        },
        titleContainer: {
            flex: 1,
            marginHorizontal: 14,
        },
        title: {
            color: c.textPrimary,
            fontSize: 17,
            fontWeight: '700',
            letterSpacing: -0.2,
        },
        subtitle: {
            color: c.textSecondary,
            fontSize: 11.5,
            marginTop: 1,
        },
        headerSpacer: {
            width: 38,
        },
    });
