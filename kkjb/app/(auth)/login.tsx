import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function Login() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Log In</Text>

            <TextInput
                placeholder="Email"
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
            />
            <TextInput
                placeholder="Password"
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

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
    },
    button: {
        backgroundColor: '#2563eb',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: { color: 'white', fontWeight: '600' },
    link: { color: '#2563eb', textAlign: 'center', marginTop: 8 },
    linkTemp: { color: 'green', textAlign: 'center', marginTop: 8 },
});