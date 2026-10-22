import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Colors, useTheme, useThemedStyles } from '../../components/theme';

export default function Signup() {
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSignup() {
        if (!fullName || !email || password.length < 6) {
            Alert.alert('Missing info', 'Enter your name, email and a password of 6+ characters.');
            return;
        }
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }, // trigger copies this into profiles
        });
        setLoading(false);
        if (error) Alert.alert('Sign up failed', error.message);
        else if (!data.session) Alert.alert('Check your email', 'Confirm your account, then log in.');
        // with a session, the root layout redirects to the app automatically
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Sign Up</Text>

            <TextInput
                placeholder="Full Name"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
            />
            <TextInput
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
            />
            <TextInput
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
            />

            <Pressable style={styles.button} onPress={handleSignup} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Sign Up'}</Text>
            </Pressable>

            <Link href="/(auth)/login">
                <Text style={styles.link}>Already have an account? Log in</Text>
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
    });
