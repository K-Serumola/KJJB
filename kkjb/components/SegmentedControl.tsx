import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, useThemedStyles } from './theme';

interface Option<T extends string> {
    value: T;
    label: string;
}

interface SegmentedControlProps<T extends string> {
    options: Option<T>[];
    value: T;
    onChange: (value: T) => void;
}

// A pill-shaped "pick one" switch, e.g.  [ Light | Dark ]
export default function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
}: SegmentedControlProps<T>) {
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.track}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <TouchableOpacity
                        key={option.value}
                        style={[styles.segment, selected && styles.segmentSelected]}
                        onPress={() => onChange(option.value)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                    >
                        <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        track: {
            flexDirection: 'row',
            backgroundColor: c.inset,
            borderRadius: 12,
            padding: 3,
            borderWidth: 1,
            borderColor: c.border,
        },
        segment: {
            flex: 1,
            paddingVertical: 9,
            borderRadius: 9,
            alignItems: 'center',
        },
        segmentSelected: {
            backgroundColor: c.accent,
        },
        label: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
        labelSelected: { color: c.onAccent },
    });
