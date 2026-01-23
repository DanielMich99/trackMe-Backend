import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Platform,
    Image,
    ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Region, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { AntDesign, Octicons } from '@expo/vector-icons';
import { FloatingMemberCard } from '../components/FloatingMemberCard';

// --- Types ---
interface MemberLocation {
    userId: string;
    userName: string;
    latitude: number;
    longitude: number;
    role?: string;
}

interface DangerZone {
    id: number;
    name: string;
    polygon: {
        coordinates: number[][][];
    };
}

// --- Marker Components ---
const MeMarker = ({ coordinate, isZoomedOut }: { coordinate: any, isZoomedOut: boolean }) => {
    const [tracksViewChanges, setTracksViewChanges] = useState(true);

    useEffect(() => {
        setTracksViewChanges(true);
        const timer = setTimeout(() => {
            setTracksViewChanges(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [isZoomedOut]);

    return (
        <Marker
            coordinate={coordinate}
            zIndex={2}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksViewChanges}
            key="me"
        >
            <View style={styles.markerContainer}>
                {isZoomedOut ? (
                    <View style={[styles.dotMarker, { backgroundColor: '#22c55e' }]} />
                ) : (
                    <View style={[styles.circleMarker, { backgroundColor: '#22c55e' }]}>
                        <Text style={styles.circleText}>Me</Text>
                    </View>
                )}
            </View>
        </Marker>
    );
};

const MemberMarker = ({
    member,
    isZoomedOut,
    isFlashing,
    onMemberPress
}: {
    member: MemberLocation,
    isZoomedOut: boolean,
    isFlashing: boolean,
    onMemberPress?: (member: MemberLocation) => void
}) => {
    const [tracksViewChanges, setTracksViewChanges] = useState(true);

    useEffect(() => {
        setTracksViewChanges(true);
        const timer = setTimeout(() => {
            setTracksViewChanges(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [isFlashing, isZoomedOut]);

    const baseColor = isFlashing ? '#ef4444' : '#3b82f6';
    const firstLetter = member.userName.charAt(0).toUpperCase();

    return (
        <Marker
            coordinate={{ latitude: member.latitude, longitude: member.longitude }}
            zIndex={isFlashing ? 10 : 1}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksViewChanges}
            key={member.userId}
            onPress={() => onMemberPress?.(member)}
        >
            <View style={styles.markerContainer}>
                {isZoomedOut ? (
                    <View style={[styles.dotMarker, {
                        backgroundColor: baseColor,
                        transform: [{ scale: isFlashing ? 1.5 : 1 }]
                    }]} />
                ) : (
                    <View style={[styles.circleMarker, {
                        backgroundColor: baseColor,
                        transform: [{ scale: isFlashing ? 1.2 : 1 }]
                    }]}>
                        <Text style={styles.circleText}>
                            {firstLetter}
                        </Text>
                    </View>
                )}
            </View>
        </Marker>
    );
};

// --- Logic Hook ---
const useMapLogic = () => {
    const { user, groups, activeGroupId, setActiveGroup, fetchGroups, logout } = useAuthStore();

    // State
    const [myLocation, setMyLocation] = useState<Location.LocationObject | null>(null);
    const [members, setMembers] = useState<MemberLocation[]>([]);
    const [zones, setZones] = useState<DangerZone[]>([]);
    const [sosActive, setSosActive] = useState(false);

    const activeGroup = useMemo(() => groups.find(g => g.id === activeGroupId), [groups, activeGroupId]);

    // Data Fetching
    const fetchData = useCallback(async () => {
        if (!activeGroupId) return;
        try {
            const [membersRes, zonesRes] = await Promise.all([
                api.get(`/groups/locations?groupId=${activeGroupId}`),
                api.get(`/areas/group/${activeGroupId}`),
            ]);
            setMembers(membersRes.data);
            setZones(zonesRes.data);
        } catch (error) {
            console.log('Failed to fetch map data');
        }
    }, [activeGroupId]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Location Tracking (Display Only - handled globally by LocationTracker)
    useEffect(() => {
        let subscription: Location.LocationSubscription | null = null;

        const startTracking = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const location = await Location.getCurrentPositionAsync({});
            setMyLocation(location);

            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,
                    distanceInterval: 10,
                },
                (newLocation) => {
                    setMyLocation(newLocation);
                }
            );
        };

        startTracking();

        return () => {
            if (subscription) {
                subscription.remove();
            }
        };
    }, []);

    // Actions
    const createGroup = async (name: string) => {
        try {
            await api.post('/groups/create', { name });
            await fetchGroups();
            Alert.alert('Success', 'Group created!');
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to create');
        }
    };

    const joinGroup = async (code: string) => {
        try {
            await api.post('/groups/join', { joinCode: code.toUpperCase() });
            await fetchGroups();
            Alert.alert('Success', 'Joined group!');
        } catch {
            Alert.alert('Error', 'Failed to join group');
        }
    };

    const sendSos = async () => {
        Alert.alert(
            '🆘 SOS Alert',
            'Send emergency alert to your family?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send SOS',
                    style: 'destructive',
                    onPress: async () => {
                        setSosActive(true);
                        try {
                            await api.post('/sos');
                            Alert.alert('SOS Sent!', 'Family notified.');
                        } catch {
                            Alert.alert('Error', 'Failed to send SOS');
                        }
                        setTimeout(() => setSosActive(false), 3000);
                    },
                },
            ]
        );
    };

    return {
        user,
        groups,
        activeGroup,
        myLocation,
        members,
        zones,
        sosActive,
        setActiveGroup,
        createGroup,
        joinGroup,
        sendSos,
        logout,
    };
};

// --- Main Component ---
export default function MapScreen() {
    const {
        user,
        groups,
        activeGroup,
        myLocation,
        members,
        zones,
        sosActive,
        setActiveGroup,
        createGroup,
        joinGroup,
        sendSos,
        logout,
    } = useMapLogic();

    const mapRef = useRef<MapView>(null);
    const [flashingMemberId, setFlashingMemberId] = useState<string | null>(null);
    const [flashActive, setFlashActive] = useState(false);
    const [isZoomedOut, setIsZoomedOut] = useState(false);
    const [selectedMember, setSelectedMember] = useState<MemberLocation | null>(null);

    // Auto-hide selected member name after 3 seconds
    useEffect(() => {
        if (selectedMember) {
            const timer = setTimeout(() => {
                setSelectedMember(null);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [selectedMember]);

    // Flashing Effect
    useEffect(() => {
        if (!flashingMemberId) return;
        let count = 0;
        const interval = setInterval(() => {
            setFlashActive(p => !p);
            count++;
            if (count >= 8) {
                clearInterval(interval);
                setFlashingMemberId(null);
                setFlashActive(false);
            }
        }, 250);
        return () => clearInterval(interval);
    }, [flashingMemberId]);

    const focusOnMember = (member: MemberLocation) => {
        mapRef.current?.animateToRegion({
            latitude: member.latitude,
            longitude: member.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        }, 1000);
        setFlashingMemberId(member.userId);
    };

    const handleRegionChange = (region: Region) => {
        // Threshold: if we see more than ~1 degree of latitude, we are "zoomed out"
        setIsZoomedOut(region.latitudeDelta > 1.0);
    };

    // Show loading while waiting for location
    if (!myLocation) {
        return (
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
                        <View>
                            <Text style={styles.title}>TrackMe</Text>
                            <Text style={styles.subtitle}>Family Safety</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                        <AntDesign name="logout" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Locating your position...</Text>
                </View>
            </View>
        );
    }

    const initialRegion = {
        latitude: myLocation.coords.latitude,
        longitude: myLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
                    <View>
                        <Text style={styles.title}>TrackMe</Text>
                        <Text style={styles.subtitle}>Family Safety</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
                    <AntDesign name="logout" size={18} color="#94a3b8" />
                </TouchableOpacity>
            </View>

            {/* Floating Card */}
            <FloatingMemberCard
                activeGroup={activeGroup}
                members={members}
                groups={groups}
                currentUserId={user?.id}
                onFocusMember={focusOnMember}
                onSelectGroup={setActiveGroup}
                onCreateGroup={createGroup}
                onJoinGroup={joinGroup}
            />

            {/* Map */}
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                showsUserLocation={false}
                showsMyLocationButton={true}
                onRegionChangeComplete={handleRegionChange}
            >
                {/* Me */}
                <MeMarker
                    coordinate={{
                        latitude: myLocation.coords.latitude,
                        longitude: myLocation.coords.longitude,
                    }}
                    isZoomedOut={isZoomedOut}
                />

                {/* Members */}
                {members
                    .filter(m => m.userId !== user?.id)
                    .map((member) => {
                        const isFlashing = flashingMemberId === member.userId && flashActive;
                        return (
                            <MemberMarker
                                key={member.userId}
                                member={member}
                                isZoomedOut={isZoomedOut}
                                isFlashing={isFlashing}
                                onMemberPress={setSelectedMember}
                            />
                        );
                    })}

                {/* Zones */}
                {zones.map(zone => {
                    const coords = zone.polygon?.coordinates?.[0]?.map(coord => ({
                        latitude: coord[1],
                        longitude: coord[0],
                    }));
                    if (!coords) return null;
                    return (
                        <Polygon
                            key={zone.id}
                            coordinates={coords}
                            strokeColor="#EF4444"
                            fillColor="rgba(239, 68, 68, 0.3)"
                            strokeWidth={2}
                        />
                    );
                })}
            </MapView>

            {/* Selected Member Name Label */}
            {selectedMember && (
                <View style={styles.memberNameLabel}>
                    <Text style={styles.memberNameText}>{selectedMember.userName}</Text>
                </View>
            )}

            {/* SOS Button */}
            <TouchableOpacity
                style={[styles.sosButton, sosActive && styles.sosButtonActive]}
                onPress={sendSos}
                activeOpacity={0.7}
            >
                <Text style={styles.sosText}>{sosActive ? '!!!' : 'SOS'}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 55 : 35,
        paddingBottom: 15,
        backgroundColor: '#1e293b',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 50,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    logoImage: { width: 44, height: 44, borderRadius: 12 },
    title: { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
    subtitle: { fontSize: 12, color: '#64748b', letterSpacing: 1 },
    logoutBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(100, 116, 139, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    map: { flex: 1 },
    circleMarker: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        elevation: 5,
    },
    circleText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    sosButton: {
        position: 'absolute',
        bottom: 80,
        alignSelf: 'center',
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#dc2626',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
        elevation: 8,
    },
    sosButtonActive: { backgroundColor: '#7f1d1d' },
    sosText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    dotMarker: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#fff',
        elevation: 3,
    },
    markerContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
    },
    loadingText: {
        color: '#94a3b8',
        fontSize: 16,
        marginTop: 16,
    },
    memberNameLabel: {
        position: 'absolute',
        bottom: 160,
        alignSelf: 'center',
        backgroundColor: '#3b82f6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#fff',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    memberNameText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
