import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, useThemedStyles } from '../../components/theme';
import { TabBarHeightProvider, useKeyboardVisible, useScreenInsets } from '../../components/layout';

// Taken straight from <Tabs>, so it always matches the installed
// expo-router version.
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const TAB_LABELS: Record<string, string> = {
    index: 'Drive',
    rides: 'Activity',
    profile: 'Account',
};

// A guess used for the very first frame, before the bar has measured itself.
const FALLBACK_TAB_BAR_HEIGHT = 96;

function CustomTabBar({
    state,
    descriptors,
    navigation,
    onHeightChange,
}: TabBarProps & { onHeightChange: (height: number) => void }) {
    const styles = useThemedStyles(createStyles);
    const insets = useScreenInsets();
    const keyboardVisible = useKeyboardVisible();

    // While the keyboard is open the bar hides itself (otherwise it floats on
    // top of whatever you're typing into), so it takes up 0 space.
    useEffect(() => {
        if (keyboardVisible) onHeightChange(0);
    }, [keyboardVisible, onHeightChange]);

    if (keyboardVisible) return null;

    return (
        <View
            style={[styles.wrapper, { paddingBottom: insets.bottom + 8 }]}
            pointerEvents="box-none"
            // The bar measures itself and tells every screen how much room
            // to leave at the bottom, so nothing hides behind it.
            onLayout={(e) => onHeightChange(e.nativeEvent.layout.height)}
        >
            <View style={styles.bar}>
                {state.routes.map((route, index) => {
                    // Screens registered with href: null (post-ride, requests)
                    // stay routable but don't get a button in the bar.
                    const href = (descriptors[route.key].options as { href?: string | null }).href;
                    if (href === null) return null;

                    const isFocused = state.index === index;
                    const label = TAB_LABELS[route.name] ?? route.name;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });
                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    return (
                        <TouchableOpacity
                            key={route.key}
                            onPress={onPress}
                            activeOpacity={0.8}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isFocused }}
                            accessibilityLabel={label}
                            style={[styles.tabItem, isFocused && styles.tabItemActive]}
                        >
                            <View style={[styles.dot, isFocused && styles.dotActive]} />
                            <Text style={[styles.label, isFocused && styles.labelActive]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

export default function TabsLayout() {
    const [tabBarHeight, setTabBarHeight] = useState(FALLBACK_TAB_BAR_HEIGHT);

    return (
        <TabBarHeightProvider value={tabBarHeight}>
            <Tabs
                tabBar={(props) => <CustomTabBar {...props} onHeightChange={setTabBarHeight} />}
                screenOptions={{ headerShown: false }}
            >
                <Tabs.Screen name="index" options={{ title: 'Drive' }} />
                <Tabs.Screen name="rides" options={{ title: 'Activity' }} />
                <Tabs.Screen name="profile" options={{ title: 'Account' }} />
                {/* Backend screens not in the wireframe bar yet - still reachable
                    by path (/post-ride, /requests), just not shown as tabs. */}
                <Tabs.Screen name="post-ride" options={{ title: 'Post Ride', href: null }} />
                <Tabs.Screen name="requests" options={{ title: 'Requests', href: null }} />
            </Tabs>
        </TabBarHeightProvider>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        wrapper: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
        },
        bar: {
            flexDirection: 'row',
            backgroundColor: c.surface,
            borderRadius: 32,
            borderWidth: 1,
            borderColor: c.borderStrong,
            paddingHorizontal: 8,
            paddingVertical: 8,
            shadowColor: c.shadow,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.22,
            shadowRadius: 12,
            elevation: 8,
        },
        tabItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 24,
        },
        tabItemActive: {
            backgroundColor: c.accentSoft,
        },
        dot: {
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: c.textMuted,
        },
        dotActive: {
            backgroundColor: c.accentText,
        },
        label: {
            fontSize: 12,
            fontWeight: '600',
            color: c.textMuted,
        },
        labelActive: {
            color: c.accentText,
        },
    });
