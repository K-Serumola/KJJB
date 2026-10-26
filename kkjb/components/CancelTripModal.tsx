import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, useThemedStyles } from './theme';

// Why is the passenger cancelling? The driver is shown the answer.
export const CANCEL_REASONS = [
    'Changed my plans',
    'Found another way to travel',
    'Driver is running late',
    'Other',
];

type Props = {
    visible: boolean;
    title?: string;
    message?: string;
    busy?: boolean;
    onKeep: () => void; // "Keep trip" / closes the box
    onConfirm: (reason: string) => void;
};

// A small pop-up: pick a reason, then confirm. Used from the map panel and the Activity card.
export default function CancelTripModal({
    visible,
    title = 'Cancel this trip?',
    message = 'Your seat will be given back and the driver will be told.',
    busy = false,
    onKeep,
    onConfirm,
}: Props) {
    const styles = useThemedStyles(createStyles);
    const [reason, setReason] = useState<string | null>(null);

    // start fresh every time it opens
    useEffect(() => {
        if (visible) setReason(null);
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
            <Pressable style={styles.backdrop} onPress={onKeep}>
                <Pressable style={styles.card} onPress={() => {}}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <Text style={styles.label}>Why are you cancelling?</Text>
                    {CANCEL_REASONS.map((r) => {
                        const selected = reason === r;
                        return (
                            <TouchableOpacity
                                key={r}
                                style={[styles.option, selected && styles.optionSelected]}
                                onPress={() => setReason(r)}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                            >
                                <View style={[styles.radio, selected && styles.radioSelected]}>
                                    {selected && <View style={styles.radioDot} />}
                                </View>
                                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{r}</Text>
                            </TouchableOpacity>
                        );
                    })}

                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.keepBtn} onPress={onKeep} disabled={busy}>
                            <Text style={styles.keepText}>Keep trip</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.cancelBtn, (!reason || busy) && styles.disabled]}
                            onPress={() => reason && onConfirm(reason)}
                            disabled={!reason || busy}
                        >
                            <Text style={styles.cancelText}>{busy ? 'Cancelling…' : 'Cancel trip'}</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center',
            paddingHorizontal: 24,
        },
        card: {
            backgroundColor: c.surface,
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: c.borderStrong,
        },
        title: { color: c.textPrimary, fontSize: 17, fontWeight: '700' },
        message: { color: c.textSecondary, fontSize: 13, marginTop: 6 },
        label: { color: c.textSecondary, fontSize: 12.5, fontWeight: '600', marginTop: 16, marginBottom: 8 },

        option: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 11,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.inset,
            marginBottom: 8,
        },
        optionSelected: { borderColor: c.accent, backgroundColor: c.accentSoft },
        radio: {
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 2,
            borderColor: c.borderStrong,
            alignItems: 'center',
            justifyContent: 'center',
        },
        radioSelected: { borderColor: c.accent },
        radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
        optionText: { color: c.textPrimary, fontSize: 14 },
        optionTextSelected: { fontWeight: '600' },

        actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
        keepBtn: {
            flex: 1,
            borderWidth: 1,
            borderColor: c.borderStrong,
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
        },
        keepText: { color: c.textSecondary, fontSize: 13.5, fontWeight: '600' },
        cancelBtn: {
            flex: 1,
            borderWidth: 1,
            borderColor: c.danger,
            backgroundColor: c.dangerSoft,
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
        },
        cancelText: { color: c.danger, fontSize: 13.5, fontWeight: '700' },
        disabled: { opacity: 0.45 },
    });
