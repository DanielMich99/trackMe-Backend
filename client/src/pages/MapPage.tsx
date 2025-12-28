/**
 * MapPage Component
 * 
 * Main application view that displays a real-time map with user locations.
 * 
 * Features:
 * - Real-time location tracking via GPS
 * - WebSocket connection for live updates from other users
 * - Group-based filtering of visible locations
 * - SOS alert system
 * - Geofence violation alerts
 * - Member management panel
 * 
 * Data Flow:
 * 1. User's GPS position is sent to backend every few seconds
 * 2. Backend processes through Kafka → Processor → Redis
 * 3. Redis pub/sub pushes updates back via WebSocket
 * 4. Map markers update in real-time for all group members
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import GroupSelector from '../components/GroupSelector';
import SosButton from '../components/SosButton';
import Toast from '../components/Toast';
import MemberManagement from '../components/MemberManagement';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { io, Socket } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet default marker icons in bundled apps
// Leaflet uses dynamic imports which break in Vite/Webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Red icon for flashing highlighted member
let RedIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Green icon for current user (Me)
let GreenIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Component to control map from outside
function MapController({ center, zoom }: { center: [number, number] | null, zoom: number }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom, { duration: 1 });
        }
    }, [center, zoom, map]);
    return null;
}

interface LocationData {
    userId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
}

interface SosAlert {
    userId: string;
    userName: string;
    message: string;
}

interface ToastData {
    id: number;
    message: string;
    type: 'danger' | 'info';
}

export default function MapPage() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const [socket, setSocket] = useState<Socket | null>(null);

    // Store all user locations as a map: userId -> LocationData
    // This allows quick updates for individual users
    const [familyLocations, setFamilyLocations] = useState<Record<string, LocationData>>({});

    // Current user's GPS position (used to center the map)
    const [myPosition, setMyPosition] = useState<[number, number] | null>(null);

    const activeGroupId = useAuthStore((state) => state.activeGroupId);
    const [groupMembers, setGroupMembers] = useState<string[]>([]); // User IDs in active group
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const [showMembers, setShowMembers] = useState(false);

    // State for member focus feature
    const [highlightedMember, setHighlightedMember] = useState<string | null>(null);
    const [isFlashing, setIsFlashing] = useState(false);
    const [flyToPosition, setFlyToPosition] = useState<[number, number] | null>(null);

    /**
     * Clear locations when switching groups
     * This ensures we don't show markers from the previous group
     */
    useEffect(() => {
        // Clear all family locations when group changes
        setFamilyLocations({});
        setGroupMembers([]);
    }, [activeGroupId]);

    /**
     * Load members of the active group
     * Used to filter map markers to show only group members
     * 
     * TODO: Optimize by creating a dedicated endpoint for fetching
     * group members instead of loading all groups
     */
    useEffect(() => {
        if (!activeGroupId) return;

        api.get(`/groups/my-groups`)
            .then(res => {
                const groups = res.data;
                const active = groups.find((g: any) => g.id === activeGroupId);
                if (active && active.users) {
                    setGroupMembers(active.users.map((u: any) => u.id));
                }
            })
            .catch(console.error);
    }, [activeGroupId]);

    /**
     * Fetch last known locations for group members on group load
     * This ensures we show markers for offline members too
     */
    useEffect(() => {
        if (!activeGroupId) return;

        api.get(`/groups/locations?groupId=${activeGroupId}`)
            .then(res => {
                const locations = res.data;
                // Set initial locations from database
                setFamilyLocations(prev => {
                    const merged = { ...prev };
                    locations.forEach((loc: LocationData) => {
                        // Only set if we don't already have this user's location
                        // (real-time updates take precedence)
                        if (!merged[loc.userId]) {
                            merged[loc.userId] = loc;
                        }
                    });
                    return merged;
                });
            })
            .catch(err => console.error('Error fetching group locations', err));
    }, [activeGroupId]);

    /**
     * Establish WebSocket connection and set up event listeners
     * 
     * Events:
     * - newLocationReceived: Real-time location updates from other users
     * - SOS_ALERT: Emergency alerts from group members
     * - alerts: Geofence violation notifications
     * 
     * Connection is cleaned up on component unmount
     */
    useEffect(() => {
        if (!user) return;

        const newSocket = io('http://localhost:3000', {
            query: { userId: user.id },
        });

        // Listen for location updates from other users
        // Only accept updates newer than what we already have (prevents out-of-order display)
        newSocket.on('newLocationReceived', (data: LocationData) => {
            setFamilyLocations((prev) => {
                const existing = prev[data.userId];
                // If we already have a newer location for this user, ignore the stale update
                if (existing && new Date(existing.timestamp) >= new Date(data.timestamp)) {
                    console.log(`📍 Ignored stale location for user ${data.userId.slice(0, 5)}...`);
                    return prev;
                }
                return { ...prev, [data.userId]: data };
            });
        });

        // Listen for SOS emergency alerts
        newSocket.on('SOS_ALERT', (data: SosAlert) => {
            addToast(`${data.userName}: ${data.message}`, 'danger');
        });

        // Listen for geofence violation alerts
        // These are triggered when users enter danger zones
        newSocket.on('dangerZoneAlert', (data: any) => {
            addToast(`🚨 ${data.userName} entered DANGER ZONE: ${data.areaName}`, 'danger');
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [user]);

    /**
     * Add a toast notification
     * Automatically removes after 5 seconds
     * 
     * @param msg - Message to display
     * @param type - 'danger' for alerts/warnings, 'info' for general notifications
     */
    const addToast = (msg: string, type: 'danger' | 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message: msg, type }]);

        // Auto-remove toast after 5 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

    /**
     * Filter locations to show only members of the active group
     * Excludes current user (they have a separate "Me" marker)
     */
    const visibleLocations = useMemo(() => {
        // Filter out current user - they have their own green "Me" marker
        const otherUsers = Object.values(familyLocations).filter(
            loc => loc.userId !== user?.id
        );

        if (!activeGroupId) return otherUsers;

        // Filter to show only users in the active group
        return otherUsers.filter(loc => groupMembers.includes(loc.userId));
    }, [familyLocations, activeGroupId, groupMembers, user?.id]);

    /**
     * Focus map on a specific member's location
     * Triggers red flash animation on their marker
     * 
     * @param userId - ID of the member to focus on
     */
    const focusOnMember = (userId: string) => {
        const location = familyLocations[userId];
        if (!location) {
            addToast('Member location not available', 'info');
            return;
        }

        // Set position to fly to
        setFlyToPosition([location.latitude, location.longitude]);

        // Start flashing animation
        setHighlightedMember(userId);
        setIsFlashing(true);

        // Flash 3 times (toggle every 300ms, 6 toggles = 3 flashes)
        let flashCount = 0;
        const flashInterval = setInterval(() => {
            flashCount++;
            setIsFlashing(prev => !prev);

            if (flashCount >= 6) {
                clearInterval(flashInterval);
                setHighlightedMember(null);
                setIsFlashing(false);
            }
        }, 300);
    };

    /**
     * Refresh group members and locations from the database
     * Called after approving a new member to immediately show their marker
     */
    const refreshGroupLocations = () => {
        if (!activeGroupId) return;

        // First refresh the group members list
        api.get(`/groups/my-groups`)
            .then(res => {
                const groups = res.data;
                const active = groups.find((g: any) => g.id === activeGroupId);
                if (active && active.users) {
                    setGroupMembers(active.users.map((u: any) => u.id));
                    console.log('👥 Refreshed group members after approval');
                }
            })
            .catch(console.error);

        // Then refresh the locations
        api.get(`/groups/locations?groupId=${activeGroupId}`)
            .then(res => {
                const locations = res.data;
                setFamilyLocations(prev => {
                    const merged = { ...prev };
                    locations.forEach((loc: LocationData) => {
                        // Update location regardless of existing data
                        // This ensures newly approved members appear
                        merged[loc.userId] = loc;
                    });
                    return merged;
                });
                console.log('📍 Refreshed group locations after member change');
            })
            .catch(err => console.error('Error refreshing group locations', err));
    };

    /**
     * Track user's GPS position
     * Uses watchPosition only to update local state (for the map display)
     */
    useEffect(() => {
        if (!navigator.geolocation) return;

        // Start tracking GPS position (only updates local state)
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setMyPosition([latitude, longitude]);
            },
            (error) => console.error('GPS Error:', error),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    /**
     * Send location to backend every 10 seconds
     * 
     * Flow:
     * 1. Every 10 seconds, current position is sent to backend /location endpoint
     * 2. Backend sends to Kafka → Ingestion → Processor
     * 3. Processor saves to DB and publishes to Redis
     * 4. Redis pub/sub broadcasts to WebSocket Gateway
     * 5. All connected clients receive the update
     * 
     * Uses fixed interval for consistent updates regardless of movement
     */
    useEffect(() => {
        if (!myPosition) return;

        // Send current position to backend API
        const sendLocation = async () => {
            try {
                await api.post('/location', {
                    latitude: myPosition[0],
                    longitude: myPosition[1]
                });
                console.log('📤 Sent my location (interval)');
            } catch (err) {
                console.error('Error sending location', err);
            }
        };

        // Send immediately on first load
        sendLocation();

        // Then send every 10 seconds
        const intervalId = setInterval(sendLocation, 10000);

        return () => clearInterval(intervalId);
    }, [myPosition]);

    // Show loading screen while waiting for GPS permission/data
    if (!myPosition) {
        return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
            Loading GPS... (Please allow location access)
        </div>;
    }

    return (
        <div className="h-screen w-screen relative">
            {/* Toast notifications - displayed at top center */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    />
                ))}
            </div>

            <GroupSelector />

            {/* Danger Zones button - positioned at bottom-left to avoid GroupSelector dropdown */}
            {activeGroupId && (
                <div className="absolute bottom-8 left-4 z-[1000]">
                    <button
                        onClick={() => navigate('/areas')}
                        className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg shadow-lg text-sm font-bold"
                    >
                        ⚠️ Danger Zones
                    </button>
                </div>
            )}

            {/* Top Right: User Info & Controls Stack */}
            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 items-end max-h-[90vh] pointer-events-none">
                {/* User Info */}
                <div className="bg-white p-2 rounded shadow pointer-events-auto flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-700">User: {user?.email}</p>
                    <button
                        onClick={() => useAuthStore.getState().logout()}
                        className="text-xs text-red-500 hover:text-red-700 font-bold border-l pl-2 ml-2"
                    >
                        Logout
                    </button>
                </div>

                {/* Members Toggle */}
                {activeGroupId && (
                    <button
                        onClick={() => setShowMembers(!showMembers)}
                        className="bg-white p-2 rounded shadow text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-50 pointer-events-auto"
                    >
                        👥 Members {showMembers ? '▼' : '▶'}
                    </button>
                )}

                {/* Member List Panel - Flows naturally in stack */}
                {activeGroupId && showMembers && (
                    <div className="pointer-events-auto">
                        <MemberManagement
                            groupId={activeGroupId}
                            onMemberClick={focusOnMember}
                            onMemberApproved={refreshGroupLocations}
                        />
                    </div>
                )}
            </div>

            <MapContainer center={myPosition} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Map controller for flying to positions */}
                <MapController center={flyToPosition} zoom={17} />

                {/* Display location markers for all visible users */}
                {visibleLocations.map((loc) => {
                    // Determine marker icon: red if highlighted and flashing, otherwise default
                    const markerIcon = (highlightedMember === loc.userId && isFlashing)
                        ? RedIcon
                        : DefaultIcon;

                    return (
                        <Marker
                            key={loc.userId}
                            position={[loc.latitude, loc.longitude]}
                            icon={markerIcon}
                        >
                            <Popup>
                                User ID: {loc.userId.slice(0, 5)}...<br />
                                Last Seen: {new Date(loc.timestamp).toLocaleTimeString()}
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Display current user's position marker - always visible with green icon */}
                {/* Flashes red when clicked in member list, then returns to green */}
                <Marker
                    position={myPosition}
                    icon={(highlightedMember === user?.id && isFlashing) ? RedIcon : GreenIcon}
                >
                    <Popup>Me (You are here)</Popup>
                </Marker>

            </MapContainer>

            {/* SOS Button - positioned at bottom center for emergency access */}
            <SosButton />
        </div>
    );
}