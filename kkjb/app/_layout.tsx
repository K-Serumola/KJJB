import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationProvider } from '../components/NavigationContext';
import { ThemeProvider, useTheme } from '../components/theme';
import { MAX_APP_WIDTH } from '../components/layout';
import SideMenu from '../components/SideMenu';

// Lives inside ThemeProvider so it can read the current colours.
function AppShell() {
    const { colors, isDark } = useTheme();

    return (
        // Outer box fills the whole window. On a phone the inner "frame" is
        // exactly as wide as the screen; on a tablet or browser it stays a
        // phone-width column in the middle instead of stretching.
        <View style={[styles.outer, { backgroundColor: colors.mapBg }]}>
            {/* Light icons on a dark theme, dark icons on a light theme. */}
            <StatusBar style={isDark ? 'light' : 'dark'} />

            <View style={[styles.frame, { backgroundColor: colors.bg }]}>
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.bg },
                    }}
                >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="feature/[slug]" />
                </Stack>
            </View>

            {/* One side menu for the whole app (it used to be added to every
                screen separately). It only appears when opened. */}
            <SideMenu />
        </View>
    );
}

export default function RootLayout() {
    return (
        <ThemeProvider>
            <NavigationProvider>
                <AppShell />
            </NavigationProvider>
        </ThemeProvider>
    );
}

const styles = StyleSheet.create({
    outer: { flex: 1 },
    frame: {
        flex: 1,
        width: '100%',
        maxWidth: MAX_APP_WIDTH,
        alignSelf: 'center',
        overflow: 'hidden',
    },
});
