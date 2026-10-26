import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContext';
import { getProfile } from '../services/profileService';
import { getRequestHistory, getRequestsForDriver } from '../services/requestService';
import { RideRequest } from '../types';

/*
 * NOTIFICATIONS - live, in-app only (they show while the app is open).
 *
 * Two ways a change reaches this phone (both feed the SAME code, and an event
 * can never show twice):
 *   1. Realtime  - Supabase pushes a message the moment a row changes.
 *   2. Safety net - every 8 s we also re-read our own requests and compare.
 *      (So even if Realtime is switched off or drops, the banner still arrives.)
 *
 *   Driver sees:     a new request (with Accept / Decline buttons), or a passenger cancelling
 *   Passenger sees:  request accepted (with the PIN), declined, trip started,
 *                    trip completed, or the driver cancelling
 *
 * `eventTick` goes up on every change, so screens can reload their data.
 */

// What the banner needs in order to show Accept / Decline for a new request
export interface ActionableRequest {
    id: string;
    ride_id: string;
    seats_needed: number;
}

export interface AppNotification {
    id: string;
    title: string;
    body: string;
    createdAt: number;
    read: boolean;
    request?: ActionableRequest; // only set for a driver's "New ride request"
}

interface NotificationContextType {
    notifications: AppNotification[];
    unreadCount: number;
    banner: AppNotification | null;
    dismissBanner: () => void;
    markAllRead: () => void;
    refresh: () => void;
    eventTick: number;
}

const NotificationContext = createContext<NotificationContextType>({
    notifications: [],
    unreadCount: 0,
    banner: null,
    dismissBanner: () => {},
    markAllRead: () => {},
    refresh: () => {},
    eventTick: 0,
});

const BANNER_MS = 6000;
const ACTION_BANNER_MS = 15000; // a banner with buttons stays longer
const POLL_MS = 8000;

type Draft = { key: string; title: string; body: string; request?: ActionableRequest };

// Turns one request row into the notification (if any) that THIS user should see.
function describe(row: RideRequest, userId: string, who: string): Draft | null {
    if (row.passenger_id === userId) {
        // ---- I am the passenger ----
        if (row.status === 'accepted' && row.picked_up_at) {
            return { key: `${row.id}:started`, title: 'Trip started', body: 'Your driver has picked you up. Enjoy the ride!' };
        }
        if (row.status === 'accepted') {
            return {
                key: `${row.id}:accepted`,
                title: 'Request accepted 🎉',
                body: row.pin
                    ? `Your PIN is ${row.pin}. Tell it to your driver when you board.`
                    : 'Your driver accepted your request.',
            };
        }
        if (row.status === 'declined') {
            return { key: `${row.id}:declined`, title: 'Request declined', body: 'The driver could not take you. Try another ride.' };
        }
        if (row.status === 'cancelled' && row.cancelled_by === 'driver') {
            return { key: `${row.id}:cancelled`, title: 'Trip cancelled', body: 'The driver cancelled this trip.' };
        }
        if (row.status === 'completed') {
            return { key: `${row.id}:completed`, title: 'Trip completed', body: 'You have arrived. Thanks for riding!' };
        }
        return null;
    }

    // ---- Someone else's request that I can see: I am the driver ----
    if (row.status === 'pending' && row.ride_id) {
        const offer = row.fare_offer != null ? ` Offers P${Number(row.fare_offer).toFixed(0)}.` : '';
        return {
            key: `${row.id}:pending`,
            title: 'New ride request',
            body: `${who} wants a seat.${offer}`,
            request: { id: row.id, ride_id: row.ride_id, seats_needed: row.seats_needed },
        };
    }
    if (row.status === 'cancelled' && row.cancelled_by === 'passenger' && row.ride_id) {
        return {
            key: `${row.id}:cancelled`,
            title: 'Request cancelled',
            body: `${who} cancelled their seat.${row.cancel_reason ? ` Reason: ${row.cancel_reason}.` : ''}`,
        };
    }
    return null;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useUser();
    const userId = user?.id;
    const role = user?.role;

    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [banner, setBanner] = useState<AppNotification | null>(null);
    const [eventTick, setEventTick] = useState(0);

    const seen = useRef(new Set<string>()); // so the same event never shows twice
    const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Returns true only if this was a NEW event that was shown.
    const push = useCallback((d: Draft, silent: boolean): boolean => {
        if (seen.current.has(d.key)) return false;
        seen.current.add(d.key);
        if (silent) return false; // first look at old data: remember it, don't announce it
        const item: AppNotification = {
            id: d.key,
            title: d.title,
            body: d.body,
            createdAt: Date.now(),
            read: false,
            request: d.request,
        };
        setNotifications((list) => [item, ...list].slice(0, 30));
        setBanner(item);
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), d.request ? ACTION_BANNER_MS : BANNER_MS);
        return true;
    }, []);

    const dismissBanner = useCallback(() => {
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        setBanner(null);
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications((list) => (list.some((n) => !n.read) ? list.map((n) => ({ ...n, read: true })) : list));
    }, []);

    const refresh = useCallback(() => setEventTick((t) => t + 1), []);

    useEffect(() => {
        if (!userId) {
            setNotifications([]);
            setBanner(null);
            seen.current.clear();
            return;
        }

        // Look at one request row and announce it if it is new. Returns true if announced.
        const handleRow = async (row: RideRequest, who?: string, silent = false): Promise<boolean> => {
            if (!row?.id) return false;
            let draft = describe(row, userId, who ?? 'A passenger');
            if (!draft || seen.current.has(draft.key)) return false;

            // New request for a driver coming from Realtime: look up the passenger's name
            if (!who && row.passenger_id !== userId && row.status === 'pending' && !silent) {
                try {
                    const name = (await getProfile(row.passenger_id)).full_name;
                    if (name) draft = describe(row, userId, name) ?? draft;
                } catch {
                    /* keep the fallback name */
                }
            }
            return push(draft, silent);
        };

        // ---- 1. Realtime ----
        const onRequestChange = async (payload: RealtimePostgresChangesPayload<RideRequest>) => {
            setEventTick((t) => t + 1);
            if (payload.eventType === 'DELETE') return;
            await handleRow(payload.new as RideRequest);
        };

        const channel = supabase
            .channel(`app-events-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests' }, onRequestChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () =>
                setEventTick((t) => t + 1),
            )
            .subscribe((status) => {
                if (status !== 'SUBSCRIBED') console.log('realtime status:', status);
            });

        // ---- 2. Safety net: re-read my requests every few seconds ----
        let baselineDone = false; // the first read only remembers what already exists
        let polling = false;
        const poll = async () => {
            if (polling) return;
            polling = true;
            try {
                let fresh = false;
                if (role === 'driver') {
                    const rows = await getRequestsForDriver(userId);
                    for (const r of rows) {
                        if (await handleRow(r, r.profiles?.full_name ?? 'A passenger', !baselineDone)) fresh = true;
                    }
                } else {
                    const rows = await getRequestHistory(userId);
                    for (const r of rows) {
                        if (await handleRow(r, undefined, !baselineDone)) fresh = true;
                    }
                }
                baselineDone = true;
                if (fresh) setEventTick((t) => t + 1);
            } catch (e: any) {
                console.log('notification check failed:', e?.message ?? e);
            }
            polling = false;
        };

        let timer: ReturnType<typeof setInterval> | null = null;
        const start = () => {
            if (timer) return;
            poll();
            timer = setInterval(poll, POLL_MS);
        };
        const stop = () => {
            if (timer) clearInterval(timer);
            timer = null;
        };
        if (AppState.currentState === 'active') start();
        const sub = AppState.addEventListener('change', (state) => (state === 'active' ? start() : stop()));

        return () => {
            stop();
            sub.remove();
            supabase.removeChannel(channel);
        };
    }, [userId, role, push]);

    const value = useMemo<NotificationContextType>(
        () => ({
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
            banner,
            dismissBanner,
            markAllRead,
            refresh,
            eventTick,
        }),
        [notifications, banner, dismissBanner, markAllRead, refresh, eventTick],
    );

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);
