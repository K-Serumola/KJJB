import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { Colors, useTheme, useThemedStyles } from '../../components/theme';

export default function Login() {
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Log In</Text>

            <TextInput
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
            />
            <TextInput
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                secureTextEntry
            />

            <Pressable style={styles.button}>
                <Text style={styles.buttonText}>Log In</Text>
            </Pressable>

            <Link href="/(auth)/signup">
                <Text style={styles.link}>Don't have an account? Sign up</Text>
            </Link>

            <Link href="/(tabs)">
                <Text style={styles.linkTemp}>Skip to app (temp)</Text>
            </Link>
        </View>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: c.bg },
        title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', color: c.textPrimary },
        input: {
            borderWidth: 1,
            borderColor: c.borderStrong,
            borderRadius: 10,
            padding: 12,
            backgroundColor: c.surface,
            color: c.textPrimary,
            fontSize: 15,
        },
        button: {
            backgroundColor: c.accent,
            padding: 14,
            borderRadius: 10,
            alignItems: 'center',
            marginTop: 8,
        },
        buttonText: { color: c.onAccent, fontWeight: '600' },
        link: { color: c.accentText, textAlign: 'center', marginTop: 8 },
        linkTemp: { color: c.success, textAlign: 'center', marginTop: 8 },
    });
