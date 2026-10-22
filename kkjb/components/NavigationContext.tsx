import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'passenger' | 'driver';

export interface ActiveRideInfo {
    role: UserRole;
    counterpart: string;
    subtitle: string;
    origin: string;
    destination: string;
    price: number;
    pin: string;
}

interface NavigationContextType {
    isSideMenuOpen: boolean;
    openSideMenu: () => void;
    closeSideMenu: () => void;
    toggleSideMenu: () => void;
    userRole: UserRole;
    setUserRole: (role: UserRole) => void;
    toggleUserRole: () => void;
    activeRide: ActiveRideInfo | null;
    startRide: (ride: ActiveRideInfo) => void;
    endRide: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
    const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
    const [userRole, setUserRole] = useState<UserRole>('passenger');
    const [activeRide, setActiveRide] = useState<ActiveRideInfo | null>(null);

    const openSideMenu = () => setIsSideMenuOpen(true);
    const closeSideMenu = () => setIsSideMenuOpen(false);
    const toggleSideMenu = () => setIsSideMenuOpen((prev) => !prev);

    const toggleUserRole = () => {
        setUserRole((prev) => (prev === 'passenger' ? 'driver' : 'passenger'));
    };

    const startRide = (ride: ActiveRideInfo) => setActiveRide(ride);
    const endRide = () => setActiveRide(null);

    return (
        <NavigationContext.Provider
            value={{
                isSideMenuOpen,
                openSideMenu,
                closeSideMenu,
                toggleSideMenu,
                userRole,
                setUserRole,
                toggleUserRole,
                activeRide,
                startRide,
                endRide,
            }}
        >
            {children}
        </NavigationContext.Provider>
    );
};

export const useAppNavigation = () => {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error('useAppNavigation must be used within a NavigationProvider');
    }
    return context;
};