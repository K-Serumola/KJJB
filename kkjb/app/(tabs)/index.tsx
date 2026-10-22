import React from 'react';
import { View } from 'react-native';
import WireframeHeader from '../../components/WireframeHeader';
import MapWireframe from '../../components/MapWireframe';
import { useTheme } from '../../components/theme';

export default function Home() {
    const { colors } = useTheme();

    // The status bar and side menu are now set up once in app/_layout.tsx.
    return (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <WireframeHeader title="RideWire" floating={true} />
            <MapWireframe />
        </View>
    );
}
