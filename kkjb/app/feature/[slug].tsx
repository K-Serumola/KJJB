import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import WireframeHeader from '../../components/WireframeHeader';
import { Colors, useThemedStyles } from '../../components/theme';
import { useScreenInsets } from '../../components/layout';
import { getFeature } from '../../components/drawerFeatures';

/*
 * One screen that shows ANY side-menu feature. The URL says which one
 * (/feature/my-routes, /feature/intercity, ...) and the content comes from
 * components/drawerFeatures.ts. When a feature gets a real, custom screen,
 * give it its own file and remove it from that list.
 */
export default function FeatureScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const feature = getFeature(Array.isArray(slug) ? slug[0] : slug);
    const styles = useThemedStyles(createStyles);
    const insets = useScreenInsets();

    if (!feature) {
        return (
            <View style={styles.container}>
                <WireframeHeader title="Not found" showBackButton />
                <Text style={styles.emptyText}>That feature doesn’t exist.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <WireframeHeader title={feature.title} subtitle={feature.note} showBackButton />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.introCard}>
                    <View style={styles.iconChip}>
                        <Text style={styles.iconText}>{feature.icon}</Text>
                    </View>
                    <Text style={styles.introText}>{feature.intro}</Text>
                </View>

                <Text style={styles.sectionLabel}>Preview · sample data</Text>
                <View style={styles.card}>
                    {feature.rows.map((row, index) => (
                        <View key={row.title}>
                            {index > 0 && <View style={styles.divider} />}
                            <View style={styles.row}>
                                <Text style={styles.rowTitle}>{row.title}</Text>
                                <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
                                {row.tag ? (
                                    <View style={styles.tag}>
                                        <Text style={styles.tagText}>{row.tag}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    ))}
                </View>

                {feature.cta ? (
                    <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85}>
                        <Text style={styles.primaryBtnText}>{feature.cta}</Text>
                    </TouchableOpacity>
                ) : null}

                <Text style={styles.footnote}>
                    Wireframe screen. Not connected to the back-end yet.
                </Text>
            </ScrollView>
        </View>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: c.bg },
        scroll: { flex: 1 },
        scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

        introCard: {
            flexDirection: 'row',
            gap: 12,
            alignItems: 'flex-start',
            backgroundColor: c.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 22,
            borderWidth: 1,
            borderColor: c.border,
        },
        iconChip: {
            width: 42,
            height: 42,
            borderRadius: 12,
            backgroundColor: c.inset,
            alignItems: 'center',
            justifyContent: 'center',
        },
        iconText: { fontSize: 20 },
        introText: { flex: 1, color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },

        sectionLabel: {
            color: c.textMuted,
            fontSize: 11.5,
            fontWeight: '600',
            marginBottom: 8,
            marginLeft: 2,
        },
        card: {
            backgroundColor: c.surface,
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: c.border,
        },
        divider: { height: 1, backgroundColor: c.border, marginVertical: 12 },
        row: { alignItems: 'flex-start' },
        rowTitle: { color: c.textPrimary, fontSize: 14.5, fontWeight: '600' },
        rowSubtitle: { color: c.textSecondary, fontSize: 12.5, marginTop: 2 },
        tag: {
            marginTop: 8,
            backgroundColor: c.accentSoft,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        tagText: { color: c.accentText, fontSize: 11, fontWeight: '600' },

        primaryBtn: {
            backgroundColor: c.accent,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
        },
        primaryBtnText: { color: c.onAccent, fontSize: 14.5, fontWeight: '600' },
        footnote: { color: c.textMuted, fontSize: 11.5, textAlign: 'center', marginTop: 14 },
        emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40 },
    });
