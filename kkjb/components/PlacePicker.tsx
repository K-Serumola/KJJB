import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { getRecentPlaces, removeRecentPlace } from '../services/recentPlaces';
import { Colors, useTheme, useThemedStyles } from './theme';
import {
    Place,
    PlaceSuggestion,
    findPlaceByText,
    getPlaceDetails,
    newSessionToken,
    searchPlaces,
} from '../services/placeService';

// Quick-pick chips. `query` is what we ask Google for, so the coordinates
// always come from a real place lookup instead of being typed in by hand.
const QUICK_PLACES = [
    { label: 'UB Campus', query: 'University of Botswana, Gaborone' },
    { label: 'CBD iTowers', query: 'iTowers, Gaborone CBD' },
    { label: 'Airport Junction', query: 'Airport Junction Mall, Gaborone' },
    { label: 'Game City', query: 'Game City Mall, Gaborone' },
];

const MIN_CHARS = 3;
const DEBOUNCE_MS = 350;

type Props = {
    value: Place | null;
    onChange: (place: Place | null) => void;
    placeholder?: string;
    bias?: { lat: number; lng: number } | null; // phone position, to favour nearby results
};

export default function PlacePicker({ value, onChange, placeholder = 'Search for a place', bias }: Props) {
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);

    const [text, setText] = useState(value?.label ?? '');
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [loading, setLoading] = useState(false); // typing -> waiting for suggestions
    const [resolving, setResolving] = useState(false); // tapped something -> getting its location
    const [error, setError] = useState<string | null>(null);

    const [recents, setRecents] = useState<Place[]>([]);

    // Load the places this person has used before (the picker is rebuilt each time
    // the sheet goes back to "idle", so this also refreshes after a trip).
    useEffect(() => {
        let alive = true;
        getRecentPlaces().then((list) => {
            if (alive) setRecents(list);
        });
        return () => {
            alive = false;
        };
    }, []);

    const sessionToken = useRef(newSessionToken());
    const searchRun = useRef(0); // lets us ignore answers that arrive late
    const skipSearchFor = useRef<string | null>(null);
    const typing = useRef(false);

    // Parent filled the box (a place was chosen) or cleared it (e.g. "Search again").
    useEffect(() => {
        if (value) {
            setText(value.label);
        } else if (!typing.current) {
            setText('');
            setSuggestions([]);
        }
        typing.current = false;
    }, [value]);

    // Search a moment after the user stops typing.
    useEffect(() => {
        const query = text.trim();
        if (value || query.length < MIN_CHARS || skipSearchFor.current === text) {
            setSuggestions([]);
            setLoading(false);
            return;
        }

        const run = ++searchRun.current;
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const results = await searchPlaces(query, sessionToken.current, bias);
                if (run !== searchRun.current) return; // user kept typing
                setSuggestions(results);
                setError(null);
            } catch (e: any) {
                if (run !== searchRun.current) return;
                console.warn('Place search failed:', e.message);
                setSuggestions([]);
                setError("Couldn't search places. Check your connection and try again.");
            }
            if (run === searchRun.current) setLoading(false);
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [text, value, bias?.lat, bias?.lng]);

    const handleType = (t: string) => {
        typing.current = true;
        skipSearchFor.current = null;
        setText(t);
        setError(null);
        if (value) onChange(null); // they edited it, so the old pick no longer applies
    };

    const handlePickSuggestion = async (s: PlaceSuggestion) => {
        searchRun.current++; // cancel any search still in flight
        skipSearchFor.current = s.main;
        setText(s.main);
        setSuggestions([]);
        setLoading(false);
        setResolving(true);
        setError(null);
        try {
            const place = await getPlaceDetails(s.place_id, sessionToken.current);
            sessionToken.current = newSessionToken(); // a session ends once a place is chosen
            onChange(place);
        } catch (e: any) {
            console.warn('Place details failed:', e.message);
            setError("Couldn't load that place. Try another one.");
        }
        setResolving(false);
    };

    // A recent place already has its coordinates saved, so no Google call is needed.
    const handlePickRecent = (place: Place) => {
        searchRun.current++;
        skipSearchFor.current = place.label;
        setSuggestions([]);
        setLoading(false);
        setError(null);
        onChange(place);
    };

    const handleForgetRecent = (place: Place) => {
        Alert.alert('Remove from recent?', place.label, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                    removeRecentPlace(place.place_id);
                    setRecents((list) => list.filter((p) => p.place_id !== place.place_id));
                },
            },
        ]);
    };

    // Default chips are hidden once a matching recent exists, so nothing shows twice.
    const sameName = (a: string, b: string) => {
        const x = a.toLowerCase();
        const y = b.toLowerCase();
        return x.includes(y) || y.includes(x);
    };
    const defaultChips = QUICK_PLACES.filter((chip) => !recents.some((r) => sameName(r.label, chip.label)));

    const handlePickChip = async (chip: (typeof QUICK_PLACES)[number]) => {
        searchRun.current++;
        skipSearchFor.current = chip.label;
        setText(chip.label);
        setSuggestions([]);
        setLoading(false);
        setResolving(true);
        setError(null);
        try {
            onChange(await findPlaceByText(chip.query, bias));
        } catch (e: any) {
            console.warn('Quick place lookup failed:', e.message);
            setError(`Couldn't find ${chip.label}. Try typing it instead.`);
        }
        setResolving(false);
    };

    return (
        <View>
            <View style={styles.inputWrap}>
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={text}
                    onChangeText={handleType}
                    autoCorrect={false}
                />
                {(loading || resolving) && <ActivityIndicator style={styles.spinner} color={colors.accentText} />}
            </View>

            {suggestions.length > 0 && (
                <View style={styles.suggestions}>
                    {suggestions.map((s, i) => (
                        <TouchableOpacity
                            key={s.place_id}
                            style={[styles.suggestion, i === suggestions.length - 1 && styles.suggestionLast]}
                            onPress={() => handlePickSuggestion(s)}
                        >
                            <Text style={styles.suggestionMain} numberOfLines={1}>{s.main}</Text>
                            {!!s.secondary && (
                                <Text style={styles.suggestionSecondary} numberOfLines={1}>{s.secondary}</Text>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            {value && !error && (
                <Text style={styles.pickedText} numberOfLines={2}>✓ {value.address}</Text>
            )}

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.presetRow}
                contentContainerStyle={styles.presetContent}
                keyboardShouldPersistTaps="handled"
            >
                {recents.map((place) => (
                    <TouchableOpacity
                        key={place.place_id}
                        style={[styles.presetChip, styles.recentChip]}
                        onPress={() => handlePickRecent(place)}
                        onLongPress={() => handleForgetRecent(place)}
                        disabled={resolving}
                    >
                        <Text style={styles.presetText}>↺ {place.label}</Text>
                    </TouchableOpacity>
                ))}
                {defaultChips.map((chip) => (
                    <TouchableOpacity
                        key={chip.label}
                        style={styles.presetChip}
                        onPress={() => handlePickChip(chip)}
                        disabled={resolving}
                    >
                        <Text style={styles.presetText}>{chip.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        inputWrap: { justifyContent: 'center', marginBottom: 8 },
        input: {
            backgroundColor: c.inset,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            paddingRight: 44,
            color: c.textPrimary,
            fontSize: 14,
        },
        spinner: { position: 'absolute', right: 14 },

        suggestions: {
            backgroundColor: c.inset,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            marginBottom: 8,
        },
        suggestion: {
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
        },
        suggestionLast: { borderBottomWidth: 0 },
        suggestionMain: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
        suggestionSecondary: { color: c.textSecondary, fontSize: 12, marginTop: 2 },

        errorText: { color: c.danger, fontSize: 12, marginBottom: 8 },
        pickedText: { color: c.textSecondary, fontSize: 12, marginBottom: 8 },

        presetRow: { marginBottom: 16, marginHorizontal: -16 },
        presetContent: { paddingHorizontal: 16 },
        presetChip: {
            backgroundColor: c.inset,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
            marginRight: 8,
            borderWidth: 1,
            borderColor: c.border,
        },
        recentChip: { borderColor: c.borderStrong },
        presetText: { color: c.textSecondary, fontSize: 12, fontWeight: '500' },
    });
