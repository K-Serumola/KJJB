import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getProfile, switchRole, updateDetails } from '../../services/profileService';
import { Profile as ProfileType } from '../../types';

export default function Profile() {
    const [profile, setProfile] = useState<ProfileType | null>(null);
    const [name, setName] = useState('');

    const load = useCallback(async () => {
        try {
            const { data } = await supabase.auth.getSession();
            const userId = data.session?.user.id;
            if (!userId) return;
            const p = await getProfile(userId);
            setProfile(p);
            setName(p.full_name ?? '');
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    async function handleSave() {
        if (!profile) return;
        try {
            await updateDetails(profile.id, name);
            Alert.alert('Saved');
            load();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    }

    async function handleSwitch() {
        if (!profile) return;
        try {
            await switchRole(profile.id);
            load();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    }

    if (!profile) return <View style={styles.container}><Text>Loading...</Text></View>;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Profile</Text>
            <Text>Current role: {profile.role}</Text>

            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />
            <Pressable style={styles.button} onPress={handleSave}>
                <Text style={styles.buttonText}>Save details</Text>
            </Pressable>

            <Pressable style={styles.buttonAlt} onPress={handleSwitch}>
                <Text style={styles.buttonText}>
                    Switch to {profile.role === 'driver' ? 'passenger' : 'driver'}
                </Text>
            </Pressable>

            <Pressable onPress={() => supabase.auth.signOut()}>
                <Text style={styles.logout}>Log out</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
    button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' },
    buttonAlt: { backgroundColor: '#0d9488', padding: 14, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: 'white', fontWeight: '600' },
    logout: { color: 'red', textAlign: 'center', marginTop: 8 },
});