import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function Signup() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Sign Up</Text>

            <TextInput placeholder="Full Name" style={styles.input} />
            <TextInput
                placeholder="Email"
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
            />
            <TextInput placeholder="Password" style={styles.input} secureTextEntry />

            <Pressable style={styles.button}>
                <Text style={styles.buttonText}>Sign Up</Text>
            </Pressable>

            <Link href="/(auth)/login">
                <Text style={styles.link}>Already have an account? Log in</Text>
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
});