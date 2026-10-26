import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    AppState,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    Platform,
    useWindowDimensions,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useAppNavigation } from './NavigationContext';
import { Colors, useTheme, useThemedStyles } from './theme';
import { useTabBarHeight } from './layout';
import InRideView from './InRideView';
import PlacePicker from './PlacePicker';
import CancelTripModal from './CancelTripModal';
import ThemedMap from './ThemedMap';
import { useUser } from './UserContext';
import { useNotifications } from './NotificationContext';
import {
    submitRequest,
    chooseRide,
    findMatches,
    getMyOpenRequest,
    getRequestsForRide,
    cancelRequest as cancelSentRequest,
} from '../services/requestService';
import { getProfile } from '../services/profileService';
import { postRide, cancelRide, finishRide, getMyActiveRide, getRide } from '../services/rideService';
import { calculateDrivingRoute } from '../services/routeService';
import { cancelRequest } from '../services/cancelRequest';
import { Place } from '../services/placeService';
import { addRecentPlace } from '../services/recentPlaces';
import { Ride, RideMatch, RideRequest } from '../types';

type FoundRide = { match: RideMatch; driverName: string };
type LatLng = { latitude: number; longitude: number };

const pt = (lat: number, lng: number): LatLng => ({ latitude: lat, longitude: lng });

// Ask the phone where it is right now (null if permission is off or GPS fails).
async function getFreshPosition(): Promise<LatLng | null> {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return pt(loc.coords.latitude, loc.coords.longitude);
    } catch {
        return null;
    }
}

// Google Routes returns an encoded polyline. Decode it locally so the map can
// draw the same road route that was used by the server-side match calculation.
function decodeGooglePolyline(encoded: string): LatLng[] {
    const points: LatLng[] = [];
    let index = 0;
    let latitude = 0;
    let longitude = 0;

    while (index < encoded.length) {
        let result = 0;
        let shift = 0;
        let byte: number;
        do {
            if (index >= encoded.length) return [];
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        latitude += result & 1 ? ~(result >> 1) : result >> 1;

        result = 0;
        shift = 0;
        do {
            if (index >= encoded.length) return [];
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        longitude += result & 1 ? ~(result >> 1) : result >> 1;

        points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
    }

    return points;
}

function routeCoordinates(match: RideMatch): LatLng[] | null {
    const route = match.ride.route_polyline
        ? decodeGooglePolyline(match.ride.route_polyline)
        : [];

    return route.length >= 2 ? route : null;
}

// Room around the route so it doesn't hide under the floating header or the sheet
const EDGE = { top: 110, right: 60, bottom: 60, left: 60 };

export default function MapWireframe() {
    const { activeRide } = useAppNavigation();
    const router = useRouter();
    const { eventTick } = useNotifications();
    const { user } = useUser();
    const userRole = user?.role ?? 'passenger';
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const tabBarHeight = useTabBarHeight();
    const { height: windowHeight } = useWindowDimensions();

    // ---- Keyboard ----
    // On newer Android the screen does not shrink when the keyboard opens, so the
    // keyboard simply covered the bottom sheet. We measure how much of our screen it
    // covers and lift the sheet by that amount (works whether or not the screen resizes).
    const containerRef = useRef<View>(null);
    const [kb, setKb] = useState<{ overlap: number; available: number } | null>(null);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', (e) => {
            const keyboardTop = e.endCoordinates.screenY;
            containerRef.current?.measureInWindow((_x, y, _w, h) => {
                setKb({
                    overlap: Math.max(0, y + h - keyboardTop),
                    available: Math.max(0, keyboardTop - y),
                });
            });
        });
        const hide = Keyboard.addListener('keyboardDidHide', () => setKb(null));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    // ---- Map ----
    const mapRef = useRef<MapView>(null);
    const [myPos, setMyPos] = useState<LatLng | null>(null);
    const [searchOrigin, setSearchOrigin] = useState<LatLng | null>(null);
    const [driverOrigin, setDriverOrigin] = useState<LatLng | null>(null);
    const [passengerRoute, setPassengerRoute] = useState<LatLng[] | null>(null);
    const [driverRoute, setDriverRoute] = useState<LatLng[] | null>(null);

    // Passenger state
    const [fareOffer, setFareOffer] = useState(12);
    const [passengerState, setPassengerState] = useState<'idle' | 'searching' | 'matched'>('idle');
    const [place, setPlace] = useState<Place | null>(null);
    const [requestId, setRequestId] = useState<string | null>(null);
    const [found, setFound] = useState<FoundRide[]>([]);
    const [busy, setBusy] = useState(false);
    const [previewFailed, setPreviewFailed] = useState(false);

    // Which "Find a ride" press is current. Cancelling bumps it, so a search
    // that finishes late knows it was cancelled and throws its answer away.
    const searchRun = useRef(0);
    // The request row created by the current search (so Cancel can close it).
    const pendingRequestId = useRef<string | null>(null);

    // The request this passenger already sent to a driver (and that isn't over yet).
    // While it exists the passenger can't request another driver.
    const [openRequest, setOpenRequest] = useState<RideRequest | null>(null);
    const [openDriverName, setOpenDriverName] = useState('your driver');
    const [openDepartAt, setOpenDepartAt] = useState<string | null>(null); // when the driver leaves
    const [cancelModal, setCancelModal] = useState(false);
    const [cancelBusy, setCancelBusy] = useState(false);

    // Driver state
    const [driverPlace, setDriverPlace] = useState<Place | null>(null);
    const [seats, setSeats] = useState(3);
    const [departsIn, setDepartsIn] = useState(15); // minutes from now
    // The driver's open ride, read from the database (so it survives restarts and
    // shows the same on every screen). While it exists the driver can't post another.
    const [currentRide, setCurrentRide] = useState<Ride | null>(null);
    const [rideCounts, setRideCounts] = useState({ pending: 0, accepted: 0 });
    const [now, setNow] = useState(Date.now());

    // Where is the phone right now? Asked when the screen opens AND every time
    // the app comes back to the foreground, so it never keeps an old spot
    // (e.g. your house) after you've travelled.
    useEffect(() => {
        let alive = true;
        const refresh = async () => {
            const here = await getFreshPosition();
            if (alive && here) setMyPos(here);
        };
        refresh();
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') refresh();
        });
        return () => {
            alive = false;
            sub.remove();
        };
    }, []);

    // Calculate previews through Supabase so the Google key stays on the server.
    // The route starts from where the phone is RIGHT NOW: each time a place is
    // picked we ask for a fresh GPS fix first. (After "Find a ride" the exact
    // spot used for the request is kept, so the line matches the request.)
    useEffect(() => {
        let cancelled = false;
        setPreviewFailed(false);
        if (userRole !== 'passenger' || !place) {
            setPassengerRoute(null);
            return;
        }

        (async () => {
            try {
                const from = searchOrigin ?? (await getFreshPosition()) ?? myPos;
                if (cancelled) return;
                if (!from) throw new Error('Could not find your location');
                if (!searchOrigin) setMyPos(from);
                const route = await calculateDrivingRoute({
                    origin_lat: from.latitude,
                    origin_lng: from.longitude,
                    destination_lat: place.lat,
                    destination_lng: place.lng,
                });
                const points = decodeGooglePolyline(route.polyline);
                if (!cancelled) setPassengerRoute(points.length >= 2 ? points : null);
            } catch (e: any) {
                console.warn('Passenger route preview failed:', e?.message ?? e);
                if (!cancelled) {
                    setPassengerRoute(null);
                    setPreviewFailed(true);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userRole, place?.lat, place?.lng, searchOrigin?.latitude, searchOrigin?.longitude]);

    useEffect(() => {
        let cancelled = false;
        setPreviewFailed(false);
        if (userRole !== 'driver' || !driverPlace) {
            if (!currentRide) setDriverRoute(null);
            return;
        }

        (async () => {
            try {
                const from = driverOrigin ?? (await getFreshPosition()) ?? myPos;
                if (cancelled) return;
                if (!from) throw new Error('Could not find your location');
                if (!driverOrigin) setMyPos(from);
                const route = await calculateDrivingRoute({
                    origin_lat: from.latitude,
                    origin_lng: from.longitude,
                    destination_lat: driverPlace.lat,
                    destination_lng: driverPlace.lng,
                });
                const points = decodeGooglePolyline(route.polyline);
                if (!cancelled) setDriverRoute(points.length >= 2 ? points : null);
            } catch (e: any) {
                console.warn('Driver route preview failed:', e?.message ?? e);
                if (!cancelled) {
                    setDriverRoute(null);
                    setPreviewFailed(true);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userRole, driverPlace?.lat, driverPlace?.lng, driverOrigin?.latitude, driverOrigin?.longitude]);

    // ---- Keep the driver's ride in sync with the database ----
    const loadCurrentRide = useCallback(async () => {
        if (!user || user.role !== 'driver') {
            setCurrentRide(null);
            return;
        }
        try {
            const ride = await getMyActiveRide(user.id);
            setCurrentRide(ride);
            if (ride) {
                const requests = await getRequestsForRide(ride.id);
                setRideCounts({
                    pending: requests.filter((r) => r.status === 'pending').length,
                    accepted: requests.filter((r) => r.status === 'accepted').length,
                });
            } else {
                setRideCounts({ pending: 0, accepted: 0 });
            }
        } catch (e: any) {
            console.warn('Could not load your ride:', e?.message ?? e);
        }
    }, [user?.id, user?.role]);

    // on open, and whenever something changes (a request arrives, a ride is cancelled...)
    useEffect(() => {
        loadCurrentRide();
    }, [loadCurrentRide, eventTick]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') loadCurrentRide();
        });
        return () => sub.remove();
    }, [loadCurrentRide]);

    // ---- Keep the passenger's sent request in sync with the database ----
    const loadOpenRequest = useCallback(async () => {
        if (!user || user.role === 'driver') {
            setOpenRequest(null);
            return;
        }
        try {
            const req = await getMyOpenRequest(user.id);
            setOpenRequest(req);
            if (!req) setOpenDepartAt(null);
            if (req?.ride_id) {
                try {
                    const ride = await getRide(req.ride_id);
                    setOpenDepartAt(ride.departure_time);
                    const p = await getProfile(ride.driver_id);
                    setOpenDriverName(p.full_name ?? 'your driver');
                } catch {
                    setOpenDriverName('your driver');
                }
            }
        } catch (e: any) {
            console.warn('Could not load your request:', e?.message ?? e);
        }
    }, [user?.id, user?.role]);

    useEffect(() => {
        loadOpenRequest();
    }, [loadOpenRequest, eventTick]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') loadOpenRequest();
        });
        return () => sub.remove();
    }, [loadOpenRequest]);

    // Draw the saved route of the open ride (also after the app was restarted)
    useEffect(() => {
        if (userRole !== 'driver' || !currentRide?.route_polyline) return;
        const points = decodeGooglePolyline(currentRide.route_polyline);
        if (points.length >= 2) setDriverRoute(points);
    }, [userRole, currentRide?.id, currentRide?.route_polyline]);

    // Tick every 15 s so the "leaves in" countdown stays correct
    // (also used by the passenger's "driver leaves in N min" line)
    useEffect(() => {
        if (!currentRide && !openRequest) return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 15000);
        return () => clearInterval(timer);
    }, [currentRide?.id, openRequest?.id]);

    // Zoom the map so the whole route is visible
    useEffect(() => {
        const points: LatLng[] = [];
        if (userRole === 'passenger') {
            if (passengerRoute) points.push(...passengerRoute);
            if (passengerState === 'matched') {
                found.forEach((f) => {
                    const route = routeCoordinates(f.match);
                    if (route) points.push(...route);
                });
            }
        } else {
            if (driverRoute) points.push(...driverRoute);
        }
        if (points.length >= 2) {
            mapRef.current?.fitToCoordinates(points, { edgePadding: EDGE, animated: true });
        }
    }, [userRole, passengerState, found, passengerRoute, driverRoute]);

    const adjustFare = (amount: number) => {
        setFareOffer((prev) => Math.max(8, prev + amount));
    };

    // ---- Passenger actions ----
    const handleFindRide = async () => {
        if (!user) return;
        if (!place) {
            Alert.alert('Pick a place', 'Search for a place and tap it in the list, or tap a quick place.');
            return;
        }
        const run = ++searchRun.current;
        const isCancelled = () => run !== searchRun.current;
        setPassengerState('searching');
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') throw new Error('Location permission is needed to find rides near you.');
            const here = await Location.getCurrentPositionAsync({});
            if (isCancelled()) return;
            setSearchOrigin(pt(here.coords.latitude, here.coords.longitude));

            const journey = {
                origin_lat: here.coords.latitude,
                origin_lng: here.coords.longitude,
                destination_lat: place.lat,
                destination_lng: place.lng,
            };
            const route = await calculateDrivingRoute(journey);
            if (isCancelled()) return;
            const points = decodeGooglePolyline(route.polyline);
            if (points.length < 2) throw new Error('The route service returned an invalid route.');
            setPassengerRoute(points);

            const req = await submitRequest(
                user.id,
                journey,
                new Date().toISOString(),
                1,
                fareOffer, // saved with the request in the same insert
            );
            if (isCancelled()) {
                // Cancelled while the request was being saved: close it now.
                cancelRequest(req.id).catch((e) => console.warn('Could not cancel request:', e.message));
                return;
            }
            pendingRequestId.current = req.id;
            addRecentPlace(place); // remember it so next time it's one tap

            const t0 = Date.now(); // for your NFR01 number
            const matches = await findMatches(req.id);
            console.log('match response ms:', Date.now() - t0);
            if (isCancelled()) return; // handleCancelSearch already closed the request

            const withNames: FoundRide[] = await Promise.all(
                matches.map(async (m) => {
                    try {
                        const p = await getProfile(m.ride.driver_id);
                        return { match: m, driverName: p.full_name ?? 'Driver' };
                    } catch {
                        return { match: m, driverName: 'Driver' };
                    }
                }),
            );
            if (isCancelled()) return;
            setRequestId(req.id);
            setFound(withNames);
            setPassengerState('matched');
        } catch (e: any) {
            if (isCancelled()) return; // the user already left this search, so don't pop an alert
            closePendingRequest();
            Alert.alert('Could not find rides', e.message);
            setPassengerState('idle');
        }
    };

    // Close the request row of the current search (if there is one and it was never sent to a driver).
    const closePendingRequest = () => {
        const id = pendingRequestId.current;
        pendingRequestId.current = null;
        if (id) cancelRequest(id).catch((e) => console.warn('Could not cancel request:', e.message));
    };

    const handleSearchAgain = (closeRequest = true) => {
        // "Search again" abandons the found rides, so close that request too,
        // except right after the passenger sent it to a driver.
        if (closeRequest) closePendingRequest();
        pendingRequestId.current = null;
        setPlace(null);
        setFound([]);
        setRequestId(null);
        setSearchOrigin(null);
        setPassengerRoute(null);
        setPassengerState('idle');
    };

    const handleRequestSeat = async (f: FoundRide) => {
        if (!requestId || busy) return;
        setBusy(true);
        try {
            await chooseRide(requestId, f.match.ride.id);
            Alert.alert('Request sent', `${f.driverName} will accept or decline it. You'll get a notification.`);
            handleSearchAgain(false); // false = keep this request, a driver now has it
            loadOpenRequest();
        } catch (e: any) {
            Alert.alert('Could not send request', e.message);
            loadOpenRequest(); // maybe you already have one open: show it
        }
        setBusy(false);
    };

    const handleCancelSearch = () => {
        searchRun.current++; // any search still running will now throw its answer away
        closePendingRequest();
        setPassengerState('idle');
    };

    const openRequests = () =>
        router.navigate({ pathname: '/(tabs)/rides', params: { tab: 'all', n: String(Date.now()) } } as any);

    const confirmCancelOpenRequest = () => {
        if (!openRequest) return;
        if (openRequest.status === 'accepted') {
            setCancelModal(true); // asks WHY (the driver is shown the reason)
            return;
        }
        Alert.alert(
            'Cancel this request?',
            openRequest.status === 'accepted'
                ? 'Your seat will be given back and the driver will be told.'
                : 'The driver will be told you no longer need a seat.',
            [
                { text: 'Keep it', style: 'cancel' },
                {
                    text: 'Cancel request',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await cancelSentRequest(openRequest.id);
                        } catch (e: any) {
                            Alert.alert('Could not cancel', e.message);
                        }
                        loadOpenRequest();
                    },
                },
            ],
        );
    };

    const handleCancelAccepted = async (reason: string) => {
        if (!openRequest) return;
        setCancelBusy(true);
        try {
            await cancelSentRequest(openRequest.id, reason);
            setCancelModal(false);
        } catch (e: any) {
            Alert.alert('Could not cancel', e.message);
        }
        setCancelBusy(false);
        loadOpenRequest();
    };

    const handleSOS = () => {
        Alert.alert('Emergency', 'Who do you need to call?', [
            { text: 'Police (999)', onPress: () => Linking.openURL('tel:999') },
            { text: 'Ambulance (997)', onPress: () => Linking.openURL('tel:997') },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    // ---- Driver actions ----
    const handleGoOnline = async () => {
        if (!user || busy) return;
        if (!driverPlace) {
            Alert.alert('Pick a destination', 'Search for a place and tap it in the list, or tap a quick place.');
            return;
        }
        setBusy(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') throw new Error('Location permission is needed to post a ride from where you are.');
            const here = await Location.getCurrentPositionAsync({});
            setDriverOrigin(pt(here.coords.latitude, here.coords.longitude));
            const journey = {
                origin_lat: here.coords.latitude,
                origin_lng: here.coords.longitude,
                destination_lat: driverPlace.lat,
                destination_lng: driverPlace.lng,
            };
            const route = await calculateDrivingRoute(journey);
            const points = decodeGooglePolyline(route.polyline);
            if (points.length < 2) throw new Error('The route service returned an invalid route.');
            setDriverRoute(points);
            const ride = await postRide(
                user.id,
                journey,
                seats,
                new Date(Date.now() + departsIn * 60000).toISOString(),
                {
                    route_polyline: route.polyline,
                    route_distance_m: route.distance_m,
                    est_duration_s: route.duration_s,
                },
            );
            setCurrentRide(ride);
            addRecentPlace(driverPlace);
        } catch (e: any) {
            Alert.alert('Could not post ride', e.message);
        }
        setBusy(false);
    };

    const confirmCancelRide = () =>
        Alert.alert(
            'Cancel this ride?',
            'Passengers who asked for a seat will be told that you cancelled.',
            [
                { text: 'Keep ride', style: 'cancel' },
                { text: 'Cancel ride', style: 'destructive', onPress: handleCancelRide },
            ],
        );

    const handleCancelRide = async () => {
        if (!currentRide || busy) return;
        setBusy(true);
        try {
            await cancelRide(currentRide.id);
            clearDriverRide();
        } catch (e: any) {
            Alert.alert('Could not cancel the ride', e.message);
        }
        setBusy(false);
    };

    const handleFinishRide = async () => {
        if (!currentRide || busy) return;
        setBusy(true);
        try {
            await finishRide(currentRide.id);
            clearDriverRide();
        } catch (e: any) {
            Alert.alert('Could not finish the ride', e.message);
        }
        setBusy(false);
    };

    // Back to the "where are you heading?" form
    const clearDriverRide = () => {
        setCurrentRide(null);
        setDriverPlace(null);
        setDriverOrigin(null);
        setDriverRoute(null);
        setRideCounts({ pending: 0, accepted: 0 });
    };

    if (activeRide) return <InRideView />;

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View ref={containerRef} style={styles.container}>
            {/* The real map. Lines: grey = the passenger's own trip,
                blue = a driver's route. */}
            <View style={styles.mapArea}>
                <ThemedMap ref={mapRef}>
                    {userRole === 'passenger' && passengerRoute && (
                        <Polyline
                            coordinates={passengerRoute}
                            strokeColor={colors.textMuted}
                            strokeWidth={3}
                        />
                    )}
                    {userRole === 'passenger' && place && (
                        <Marker coordinate={pt(place.lat, place.lng)} title={place.label} pinColor="red" />
                    )}
                    {userRole === 'passenger' &&
                        passengerState === 'matched' &&
                        found.map((f) => {
                            const route = routeCoordinates(f.match);
                            return (
                            <React.Fragment key={f.match.ride.id}>
                                {route && <Polyline coordinates={route} strokeColor={colors.accent} strokeWidth={5} />}
                                <Marker
                                    coordinate={pt(f.match.ride.origin_lat, f.match.ride.origin_lng)}
                                    title={f.driverName}
                                    description="Driver starts here"
                                    pinColor="green"
                                />
                            </React.Fragment>
                            );
                        })}

                    {userRole === 'driver' && driverRoute && (
                        <Polyline
                            coordinates={driverRoute}
                            strokeColor={colors.accent}
                            strokeWidth={5}
                        />
                    )}
                    {userRole === 'driver' && (driverPlace || currentRide) && (
                        <Marker
                            coordinate={
                                currentRide
                                    ? pt(currentRide.destination_lat, currentRide.destination_lng)
                                    : pt(driverPlace!.lat, driverPlace!.lng)
                            }
                            title={driverPlace?.label ?? 'Destination'}
                            pinColor="red"
                        />
                    )}
                </ThemedMap>

                <View style={styles.mapControls}>
                    <TouchableOpacity
                        style={styles.mapControlBtn}
                        activeOpacity={0.8}
                        accessibilityLabel="Centre on my location"
                        onPress={() =>
                            myPos &&
                            mapRef.current?.animateToRegion(
                                { ...myPos, latitudeDelta: 0.01, longitudeDelta: 0.01 },
                                500,
                            )
                        }
                    >
                        <Text style={styles.mapControlIcon}>◎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.mapControlBtn, styles.sosBtn]}
                        activeOpacity={0.8}
                        accessibilityLabel="SOS"
                        onPress={handleSOS}
                    >
                        <Text style={styles.sosText}>SOS</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom sheet. It never grows taller than ~55% of the screen
                (it scrolls instead), and it leaves room at the bottom for
                the floating tab bar so no button is ever hidden behind it. */}
            <View
                style={[
                    styles.sheet,
                    kb
                        ? { maxHeight: Math.max(220, kb.available - 90), marginBottom: kb.overlap }
                        : { maxHeight: windowHeight * 0.55 },
                ]}
            >
                <View style={styles.dragHandle} />

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: kb ? 12 : tabBarHeight + 12 }}
                >
                    {userRole === 'passenger' ? (
                        <>
                            {openRequest && (
                                <View style={styles.centerState}>
                                    <Text style={styles.sheetLabel}>
                                        {openRequest.picked_up_at
                                            ? 'Your trip is on the road'
                                            : openRequest.status === 'accepted'
                                                ? `${openDriverName} accepted your request 🎉`
                                                : `Waiting for ${openDriverName} to answer`}
                                    </Text>

                                    {openRequest.status === 'accepted' && !openRequest.picked_up_at && (
                                        <View style={styles.pinBox}>
                                            <Text style={styles.pinHint}>Tell your driver this PIN when you board (demo)</Text>
                                            <Text style={styles.pinValue}>{openRequest.pin ?? '----'}</Text>
                                        </View>
                                    )}

                                    {openRequest.status === 'accepted' && !openRequest.picked_up_at && openDepartAt && (() => {
                                        const minsLeft = Math.ceil((new Date(openDepartAt).getTime() - now) / 60000);
                                        return (
                                            <Text style={[styles.centerStateText, minsLeft <= 0 && styles.lateText]}>
                                                {minsLeft > 0
                                                    ? `Your driver leaves in ${minsLeft} min`
                                                    : `Departure time has passed and ${openDriverName} hasn't picked you up yet. You can cancel if your plans changed.`}
                                            </Text>
                                        );
                                    })()}

                                    <Text style={styles.centerStateText}>
                                        {openRequest.status === 'pending'
                                            ? 'You can send one request at a time. Cancel it if you want to try another driver.'
                                            : openRequest.picked_up_at
                                                ? 'You can request a new ride once this trip is finished.'
                                                : 'You can request a new ride once this trip is finished or cancelled.'}
                                    </Text>

                                    <TouchableOpacity
                                        style={[styles.primaryBtn, { paddingHorizontal: 28 }]}
                                        onPress={openRequests}
                                    >
                                        <Text style={styles.primaryBtnText}>View request</Text>
                                    </TouchableOpacity>
                                    {!openRequest.picked_up_at && (
                                        <TouchableOpacity onPress={confirmCancelOpenRequest}>
                                            <Text style={styles.dangerLink}>
                                                {openRequest.status === 'accepted' ? 'Cancel trip' : 'Cancel request'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                    <CancelTripModal
                                        visible={cancelModal}
                                        busy={cancelBusy}
                                        onKeep={() => setCancelModal(false)}
                                        onConfirm={handleCancelAccepted}
                                    />
                                </View>
                            )}

                            {!openRequest && passengerState === 'idle' && (
                                <>
                                    <Text style={styles.sheetLabel}>Where are you headed?</Text>
                                    <PlacePicker
                                        value={place}
                                        onChange={setPlace}
                                        placeholder="Search for a place, e.g. Airport Junction"
                                        bias={myPos ? { lat: myPos.latitude, lng: myPos.longitude } : null}
                                    />
                                    {previewFailed && (
                                        <Text style={styles.previewNote}>
                                            Couldn't draw the route preview. You can still find a ride.
                                        </Text>
                                    )}

                                    <View style={styles.fareRow}>
                                        <Text style={[styles.sheetLabel, styles.noMarginBottom]}>Your offer</Text>
                                        <View style={styles.stepper}>
                                            <TouchableOpacity
                                                style={styles.stepperBtn}
                                                onPress={() => adjustFare(-1)}
                                                accessibilityLabel="Decrease offer"
                                            >
                                                <Text style={styles.stepperBtnText}>−</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.stepperValue}>P{fareOffer.toFixed(0)}</Text>
                                            <TouchableOpacity
                                                style={styles.stepperBtn}
                                                onPress={() => adjustFare(1)}
                                                accessibilityLabel="Increase offer"
                                            >
                                                <Text style={styles.stepperBtnText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <TouchableOpacity style={styles.primaryBtn} onPress={handleFindRide}>
                                        <Text style={styles.primaryBtnText}>Find a ride</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {passengerState === 'searching' && (
                                <View style={styles.centerState}>
                                    <ActivityIndicator color={colors.accentText} />
                                    <Text style={styles.centerStateText}>Matching you with nearby drivers…</Text>
                                    <TouchableOpacity onPress={handleCancelSearch}>
                                        <Text style={styles.linkText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {passengerState === 'matched' && (
                                <>
                                    <Text style={styles.sheetLabel}>
                                        {found.length === 0
                                            ? 'No matching rides right now'
                                            : `${found.length} ride${found.length === 1 ? '' : 's'} found on your route`}
                                    </Text>
                                    {found.map((f) => (
                                        <View key={f.match.ride.id} style={styles.driverCard}>
                                            <View style={styles.rowBetween}>
                                                <View style={styles.flexShrink}>
                                                    <Text style={styles.itemTitle}>{f.driverName}</Text>
                                                    <Text style={styles.itemSubtitle}>
                                                        {f.match.ride.seats_available} seat
                                                        {f.match.ride.seats_available === 1 ? '' : 's'} left ·{' '}
                                                        {new Date(f.match.ride.departure_time).toLocaleTimeString(undefined, {
                                                            hour: 'numeric',
                                                            minute: '2-digit',
                                                        })}
                                                    </Text>
                                                </View>
                                                <Text style={styles.matchText}>{f.match.score}% match</Text>
                                            </View>
                                            <Text style={[styles.metaLine, { marginTop: 6 }]}>
                                                Pickup {f.match.pickup_distance_m} m away · detour {f.match.detour_m} m ·{' '}
                                                {f.match.time_diff_min} min from now
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.requestBtn}
                                                onPress={() => handleRequestSeat(f)}
                                                disabled={busy}
                                            >
                                                <Text style={styles.requestBtnText}>Request seat</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <TouchableOpacity onPress={() => handleSearchAgain()}>
                                        <Text style={[styles.linkText, styles.searchAgain]}>Search again</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {!currentRide && (
                                <>
                                    <Text style={styles.sheetLabel}>Where are you heading?</Text>
                                    <PlacePicker
                                        value={driverPlace}
                                        onChange={setDriverPlace}
                                        placeholder="Search for a place, e.g. Airport Junction"
                                        bias={myPos ? { lat: myPos.latitude, lng: myPos.longitude } : null}
                                    />
                                    {previewFailed && (
                                        <Text style={styles.previewNote}>
                                            Couldn't draw the route preview. You can still go online.
                                        </Text>
                                    )}

                                    <View style={styles.fareRow}>
                                        <Text style={[styles.sheetLabel, styles.noMarginBottom]}>Seats available</Text>
                                        <View style={styles.stepper}>
                                            <TouchableOpacity
                                                style={styles.stepperBtn}
                                                onPress={() => setSeats((s) => Math.max(1, s - 1))}
                                                accessibilityLabel="Fewer seats"
                                            >
                                                <Text style={styles.stepperBtnText}>−</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.stepperValue}>{seats}</Text>
                                            <TouchableOpacity
                                                style={styles.stepperBtn}
                                                onPress={() => setSeats((s) => Math.min(4, s + 1))}
                                                accessibilityLabel="More seats"
                                            >
                                                <Text style={styles.stepperBtnText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.fareRow}>
                                        <Text style={[styles.sheetLabel, styles.noMarginBottom]}>Leaves in</Text>
                                        <View style={styles.stepper}>
                                            <TouchableOpacity
                                                style={styles.stepperBtn}
                                                onPress={() => setDepartsIn((m) => Math.max(5, m - 5))}
                                                accessibilityLabel="Leave sooner"
                                            >
                                                <Text style={styles.stepperBtnText}>−</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.stepperValue}>{departsIn} min</Text>
                                            <TouchableOpacity
                                                style={styles.stepperBtn}
                                                onPress={() => setDepartsIn((m) => Math.min(120, m + 5))}
                                                accessibilityLabel="Leave later"
                                            >
                                                <Text style={styles.stepperBtnText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <TouchableOpacity style={styles.primaryBtn} onPress={handleGoOnline} disabled={busy}>
                                        <Text style={styles.primaryBtnText}>{busy ? 'Posting…' : 'Go online'}</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {currentRide && (() => {
                                const minsLeft = Math.ceil(
                                    (new Date(currentRide.departure_time).getTime() - now) / 60000,
                                );
                                const departed = minsLeft <= 0;
                                return (
                                    <View style={styles.centerState}>
                                        <Text style={styles.sheetLabel}>
                                            {departed ? 'Your ride is on the road' : 'Your ride is posted'}
                                        </Text>
                                        <Text style={styles.centerStateText}>
                                            {currentRide.seats_available} seat
                                            {currentRide.seats_available === 1 ? '' : 's'} left ·{' '}
                                            {departed ? 'departure time reached' : `leaves in ${minsLeft} min`}
                                        </Text>
                                        <Text style={styles.centerStateText}>
                                            {rideCounts.pending > 0
                                                ? `${rideCounts.pending} request${rideCounts.pending === 1 ? '' : 's'} waiting`
                                                : 'No new requests yet'}
                                            {' · '}
                                            {rideCounts.accepted} accepted
                                        </Text>

                                        {rideCounts.pending > 0 && (
                                            <TouchableOpacity
                                                style={[styles.primaryBtn, { paddingHorizontal: 28 }]}
                                                onPress={openRequests}
                                            >
                                                <Text style={styles.primaryBtnText}>Review requests</Text>
                                            </TouchableOpacity>
                                        )}
                                        {departed && (
                                            <TouchableOpacity onPress={handleFinishRide} disabled={busy}>
                                                <Text style={styles.linkText}>Finish ride</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity onPress={confirmCancelRide} disabled={busy}>
                                            <Text style={styles.dangerLink}>Cancel ride</Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })()}
                        </>
                    )}
                </ScrollView>
            </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const createStyles = (c: Colors) =>
    StyleSheet.create({
        container: { flex: 1, backgroundColor: c.bg },

        mapArea: {
            flex: 1,
            backgroundColor: c.mapBg,
            overflow: 'hidden',
        },

        mapControls: {
            position: 'absolute',
            right: 16,
            bottom: 16,
            gap: 10,
        },
        mapControlBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: c.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: c.borderStrong,
        },
        mapControlIcon: { color: c.textPrimary, fontSize: 16 },
        sosBtn: { backgroundColor: c.dangerSoft, borderColor: c.danger },
        sosText: { color: c.danger, fontSize: 10, fontWeight: '700' },

        sheet: {
            backgroundColor: c.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            borderColor: c.borderStrong,
            paddingTop: 12,
            paddingHorizontal: 16,
            shadowColor: c.shadow,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 10,
            elevation: 10,
        },
        dragHandle: {
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: c.borderStrong,
            alignSelf: 'center',
            marginBottom: 14,
        },

        sheetLabel: { color: c.textSecondary, fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
        noMarginBottom: { marginBottom: 0 },
        previewNote: { color: c.textMuted, fontSize: 12, marginBottom: 12 },

        fareRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
        stepperBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: c.inset,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: c.borderStrong,
        },
        stepperBtnText: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },
        stepperValue: { color: c.textPrimary, fontSize: 15, fontWeight: '600', minWidth: 36, textAlign: 'center' },

        primaryBtn: {
            backgroundColor: c.accent,
            borderRadius: 10,
            paddingVertical: 13,
            alignItems: 'center',
        },
        primaryBtnText: { color: c.onAccent, fontSize: 14, fontWeight: '600' },

        centerState: { alignItems: 'center', paddingVertical: 20, gap: 10 },
        pinBox: {
            backgroundColor: c.accentSoft,
            borderRadius: 12,
            padding: 12,
            alignItems: 'center',
            alignSelf: 'stretch',
        },
        lateText: { color: c.danger, fontWeight: '600' },
        pinHint: { color: c.accentText, fontSize: 12.5, textAlign: 'center' },
        pinValue: { color: c.accentText, fontSize: 30, fontWeight: '700', letterSpacing: 8, marginTop: 6 },
        centerStateText: { color: c.textSecondary, fontSize: 13, textAlign: 'center' },
        linkText: { color: c.accentText, fontSize: 13, fontWeight: '600' },
        dangerLink: { color: c.danger, fontSize: 13, fontWeight: '600' },
        searchAgain: { textAlign: 'center', marginTop: 4 },

        driverCard: {
            backgroundColor: c.inset,
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
        },
        rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
        flexShrink: { flex: 1, marginRight: 12 },
        itemTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
        itemSubtitle: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
        metaLine: { color: c.textSecondary, fontSize: 11.5 },
        matchText: { color: c.success, fontSize: 11.5, fontWeight: '600' },

        requestBtn: {
            marginTop: 10,
            borderWidth: 1,
            borderColor: c.borderStrong,
            borderRadius: 8,
            paddingVertical: 8,
            alignItems: 'center',
        },
        requestBtnText: { color: c.accentText, fontSize: 12.5, fontWeight: '600' },
    });
