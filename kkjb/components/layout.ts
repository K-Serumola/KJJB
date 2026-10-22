import { createContext, useContext, useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/*
 * LAYOUT - the helpers that make the app fit any screen.
 *
 * Phones differ in three ways that hard-coded numbers can't handle:
 *   1. notches / camera cut-outs at the top  -> safe-area insets
 *   2. gesture bars / home indicators at the bottom -> safe-area insets
 *   3. our own floating tab bar, which sits on top of the screen
 *      -> we MEASURE it and every screen leaves exactly that much room.
 */

// On tablets / wide browser windows the app stays a phone-width column in
// the middle instead of stretching cards across the whole screen.
export const MAX_APP_WIDTH = 560;

// Safe-area insets with a small floor, so spacing still looks right on
// devices/previews that report 0 (web, some Android phones).
export function useScreenInsets() {
    const insets = useSafeAreaInsets();
    return {
        top: Math.max(insets.top, 24),
        bottom: Math.max(insets.bottom, 12),
    };
}

// ---- floating tab bar height -------------------------------------------
// The tab bar (app/(tabs)/_layout.tsx) measures itself and shares its height
// here. Screens call useTabBarHeight() and add it as bottom padding, so
// nothing is ever hidden behind the bar - on any screen size.
const TabBarHeightContext = createContext(0);
export const TabBarHeightProvider = TabBarHeightContext.Provider;
export const useTabBarHeight = () => useContext(TabBarHeightContext);

// True while the on-screen keyboard is open (used to tuck the tab bar away
// so it doesn't float on top of the text field you're typing in).
export function useKeyboardVisible() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    return visible;
}
