import { Tabs } from 'expo-router';

export default function TabsLayout() {
    return (
        <Tabs>
            <Tabs.Screen name="index" options={{ title: 'Home' }} />
            <Tabs.Screen name="rides" options={{ title: 'Rides' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
            <Tabs.Screen name="post-ride" options={{ title: 'Post Ride' }} />
        </Tabs>
    );
}