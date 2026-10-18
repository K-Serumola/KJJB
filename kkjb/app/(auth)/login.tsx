import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleLogin() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) Alert.alert('Login failed', error.message);
        // on success, the root layout redirects to the app automatically
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Log In</Text>
            <TextInput placeholder="Email" style={styles.input} autoCapitalize="none"
                       keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput placeholder="Password" style={styles.input} secureTextEntry
                       value={password} onChangeText={setPassword} />
            <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Log In'}</Text>
            </Pressable>
            <Link href="/(auth)/signup">
                <Text style={styles.link}>Don't have an account? Sign up</Text>
            </Link>

            <Link href="/(tabs)">
                <Text style={styles.link}>Skip to app (temp)</Text>
            </Link>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
    button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
    buttonText: { color: 'white', fontWeight: '600' },
    link: { color: '#2563eb', textAlign: 'center', marginTop: 8 },
});