import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';

/*
 * THEME - the one place where every colour in the app lives.
 *
 * Screens never type hex codes directly. They ask for a *name*
 * (colors.surface, colors.textPrimary, ...) and the theme decides which
 * real colour that is in dark mode or light mode. Flip the mode and the
 * whole app re-colours at once.
 *
 * Using it in a screen:
 *
 *   const createStyles = (c: Colors) => StyleSheet.create({
 *       card: { backgroundColor: c.surface },
 *   });
 *
 *   export default function MyScreen() {
 *       const styles = useThemedStyles(createStyles);
 *       const { colors } = useTheme();   // only if you need a colour in JSX
 *       ...
 *   }
 */

export type ThemeMode = 'light' | 'dark';

export interface Colors {
    // Backgrounds
    bg: string;          // page background
    mapBg: string;       // the (placeholder) map area
    surface: string;     // cards, bottom sheet, tab bar
    inset: string;       // inputs / chips that sit ON a surface

    // Lines
    border: string;      // hairlines and dividers
    borderStrong: string;

    // Text
    textPrimary: string;
    textSecondary: string;
    textMuted: string;

    // Brand blue. `accent` is for FILLS (buttons, avatar). Text and icons
    // that sit on a normal surface use `accentText`, which is darker in
    // light mode so it stays readable on white.
    accent: string;
    onAccent: string;    // text that sits on top of an accent fill
    accentText: string;
    accentSoft: string;  // faint blue tint (active tab, badges)

    success: string;
    successSoft: string;
    danger: string;
    dangerSoft: string;
    star: string;

    // Misc
    overlay: string;     // dim layer behind the side menu
    switchOff: string;
    switchThumb: string;
    shadow: string;
    mapLabelBg: string;  // little labels on the map
}

// Dark = your original look. Only the two grey text shades were lightened a
// touch (muted grey was ~3:1 contrast on the cards - too faint to read
// comfortably at 11-12px).
export const darkColors: Colors = {
    bg: '#0B0D12',
    mapBg: '#10141C',
    surface: '#12151C',
    inset: '#0B0D12',

    border: 'rgba(255,255,255,0.06)',
    borderStrong: 'rgba(255,255,255,0.12)',

    textPrimary: '#F1F5F9',
    textSecondary: '#A0A8B5',
    textMuted: '#7A8494',

    accent: '#38BDF8',
    onAccent: '#08111A',
    accentText: '#38BDF8',
    accentSoft: 'rgba(56,189,248,0.14)',

    success: '#34D399',
    successSoft: 'rgba(52,211,153,0.14)',
    danger: '#F87171',
    dangerSoft: 'rgba(248,113,113,0.15)',
    star: '#FBBF24',

    overlay: 'rgba(0,0,0,0.6)',
    switchOff: '#2A2F3A',
    switchThumb: '#F1F5F9',
    shadow: '#000000',
    mapLabelBg: 'rgba(11,13,18,0.8)',
};

export const lightColors: Colors = {
    bg: '#F3F5F9',
    mapBg: '#E4EAF2',
    surface: '#FFFFFF',
    inset: '#EDF1F6',

    border: 'rgba(15,23,42,0.08)',
    borderStrong: 'rgba(15,23,42,0.16)',

    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#5D6B7E',

    accent: '#38BDF8',
    onAccent: '#08111A',
    accentText: '#0369A1',
    accentSoft: 'rgba(2,132,199,0.10)',

    success: '#047857',
    successSoft: 'rgba(4,120,87,0.10)',
    danger: '#B91C1C',
    dangerSoft: 'rgba(185,28,28,0.08)',
    star: '#B45309',

    overlay: 'rgba(15,23,42,0.45)',
    switchOff: '#CBD5E1',
    switchThumb: '#FFFFFF',
    shadow: '#0F172A',
    mapLabelBg: 'rgba(255,255,255,0.88)',
};

interface ThemeContextType {
    mode: ThemeMode;
    isDark: boolean;
    colors: Colors;
    setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Starts dark (the app's current look). The choice lives in memory only,
    // so it resets when the app restarts - saving it is a small follow-up
    // (AsyncStorage, or a column on the user's profile in the database).
    //
    // Following the phone's own setting ("System") needs two extra steps:
    // "userInterfaceStyle": "automatic" in app.json and `npx expo install
    // expo-system-ui` for Android. Then read useColorScheme() here.
    const [mode, setMode] = useState<ThemeMode>('dark');

    const value = useMemo<ThemeContextType>(
        () => ({
            mode,
            isDark: mode === 'dark',
            colors: mode === 'dark' ? darkColors : lightColors,
            setMode,
        }),
        [mode],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
    return ctx;
}

// Builds a screen's styles from the current colours, and only rebuilds them
// when the theme actually changes. Pass a function that lives OUTSIDE the
// component (see the example at the top of this file).
export function useThemedStyles<T>(factory: (colors: Colors) => T): T {
    const { colors } = useTheme();
    return useMemo(() => factory(colors), [factory, colors]);
}
