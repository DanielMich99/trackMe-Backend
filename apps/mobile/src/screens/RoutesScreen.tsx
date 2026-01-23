import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Modal,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { Octicons, FontAwesome5 } from '@expo/vector-icons';
import { GroupSelector } from '../components/GroupSelector';
import { PlaybackControls } from '../components/PlaybackControls';
import { TimeRangePickerModal } from '../components/TimeRangePickerModal';

// --- Types ---
interface LocationPoint {
    id: number;
    userId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
}

interface GroupMember {
    id: string;
    name: string;
    email: string;
}

// --- Logic Hook ---
const useRoutesLogic = () => {
    const { activeGroupId, setActiveGroup, groups, fetchGroups } = useAuthStore();
    const activeGroup = useMemo(() => groups.find(g => g.id === activeGroupId), [groups, activeGroupId]);

    const [members, setMembers] = useState<GroupMember[]>([]);
    const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);
    const [selectedDate, setSelectedDate] = useState<{ value: string; label: string } | null>(null);
    const [startTime, setStartTime] = useState<string | null>(null);  // "HH:mm"
    const [endTime, setEndTime] = useState<string | null>(null);      // "HH:mm"
    const [locations, setLocations] = useState<LocationPoint[]>([]);
    const [currentPointIndex, setCurrentPointIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // Date Generation
    const dateOptions = useMemo(() => {
        const dates = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const value = date.toISOString().split('T')[0];
            const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : date.toLocaleDateString('he-IL');
            dates.push({ value, label });
        }
        return dates;
    }, []);

    // Load members
    useEffect(() => {
        if (activeGroup?.users) {
            setMembers(activeGroup.users);
            if (!selectedMember && activeGroup.users.length > 0) {
                // Optional: Auto-select first member
            }
        }
    }, [activeGroup]);

    // Fetch History
    useEffect(() => {
        if (!selectedMember || !selectedDate || !activeGroupId) {
            setLocations([]);
            setIsPlaying(false);
            return;
        }

        setIsPlaying(false);
        const timeParams = startTime && endTime ? `&startTime=${startTime}&endTime=${endTime}` : '';
        api.get(`/location/history/${selectedMember.id}?groupId=${activeGroupId}&date=${selectedDate.value}${timeParams}`)
            .then(res => {
                setLocations(res.data);
                setCurrentPointIndex(0);
            })
            .catch(() => { });
    }, [selectedMember, selectedDate, activeGroupId, startTime, endTime]);

    const currentPoint = locations[currentPointIndex];

    const getSecondsFromMidnight = (timestamp: string) => {
        const d = new Date(timestamp);
        return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    };

    const activeSegments = useMemo(() => {
        if (!locations.length) return [];
        const segments: { start: number; end: number }[] = [];
        let start = -1;
        let end = -1;

        locations.forEach((loc) => {
            const secs = getSecondsFromMidnight(loc.timestamp);
            if (start === -1) {
                start = end = secs;
            } else if (secs - end < 300) { // 5 min gap threshold
                end = secs;
            } else {
                segments.push({ start, end });
                start = end = secs;
            }
        });
        if (start !== -1) segments.push({ start, end });
        return segments;
    }, [locations]);

    // Create array of valid time points (seconds from midnight) for slider snapping
    const validTimePoints = useMemo(() => {
        return locations.map(loc => getSecondsFromMidnight(loc.timestamp));
    }, [locations]);

    return {
        groups,
        activeGroup,
        setActiveGroup,
        fetchGroups,
        members,
        selectedMember,
        setSelectedMember,
        selectedDate,
        setSelectedDate,
        startTime,
        setStartTime,
        endTime,
        setEndTime,
        dateOptions,
        locations,
        currentPoint,
        currentPointIndex,
        setCurrentPointIndex,
        isPlaying,
        setIsPlaying,
        activeSegments,
        validTimePoints,
        getSecondsFromMidnight
    };
};


export default function RoutesScreen({ onBack }: { onBack: () => void }) {
    const {
        groups,
        activeGroup,
        setActiveGroup,
        fetchGroups,
        members,
        selectedMember,
        setSelectedMember,
        selectedDate,
        setSelectedDate,
        startTime,
        setStartTime,
        endTime,
        setEndTime,
        dateOptions,
        locations,
        currentPoint,
        currentPointIndex,
        setCurrentPointIndex,
        isPlaying,
        setIsPlaying,
        activeSegments,
        validTimePoints,
        getSecondsFromMidnight
    } = useRoutesLogic();

    const mapRef = useRef<MapView>(null);
    const [showMemberPicker, setShowMemberPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [myLocation, setMyLocation] = useState<Location.LocationObject | null>(null);

    // Get user location on mount
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({});
                setMyLocation(location);
            }
        })();
    }, []);

    // Convert time range to seconds for PlaybackControls
    const timeRangeStart = startTime
        ? parseInt(startTime.split(':')[0]) * 3600 + parseInt(startTime.split(':')[1]) * 60
        : 0;
    const timeRangeEnd = endTime
        ? parseInt(endTime.split(':')[0]) * 3600 + parseInt(endTime.split(':')[1]) * 60
        : 86399;

    // Filter Helpers
    const formatTime = (timestamp?: string) => {
        if (!timestamp) return '--:--';
        return new Date(timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    };

    // Playback Loop
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying && locations.length > 0) {
            interval = setInterval(() => {
                setCurrentPointIndex(prev => {
                    const next = prev + 1;
                    if (next >= locations.length) {
                        setIsPlaying(false);
                        return prev;
                    }
                    // Camera Follow
                    const nextPoint = locations[next];
                    mapRef.current?.animateCamera({ center: { latitude: nextPoint.latitude, longitude: nextPoint.longitude } }, { duration: 500 });
                    return next;
                });
            }, 500);
        }
        return () => clearInterval(interval);
    }, [isPlaying, locations]);

    // Fit map on load
    useEffect(() => {
        if (locations.length > 0 && mapRef.current) {
            const coords = locations.map(l => ({ latitude: l.latitude, longitude: l.longitude }));
            mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });
        }
    }, [locations]);

    // Seeker
    const handleSeek = (val: number) => {
        setIsPlaying(false);
        // Find closest point
        let closestIdx = 0;
        let minDiff = 86400;
        locations.forEach((loc, idx) => {
            const secs = getSecondsFromMidnight(loc.timestamp);
            const diff = Math.abs(secs - val);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = idx;
            }
        });
        setCurrentPointIndex(closestIdx);
    };

    // Show loading while waiting for location
    if (!myLocation) {
        return (
            <View style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Locating your position...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Octicons name="arrow-left" size={24} color="#3b82f6" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <GroupSelector
                        activeGroup={activeGroup}
                        groups={groups}
                        onSelectGroup={setActiveGroup}
                    // Explicitly NO create/join props as requested
                    >
                        {/* Integrated Filters as Children */}
                        <View style={styles.filterRow}>
                            <TouchableOpacity style={styles.filterBtn} onPress={() => setShowMemberPicker(true)}>
                                <Octicons name="person" size={12} color="#94a3b8" />
                                <View style={{ marginLeft: 6, flex: 1 }}>
                                    <Text style={styles.filterLabel}>Member</Text>
                                    <Text style={styles.filterText} numberOfLines={1}>
                                        {selectedMember?.name || selectedMember?.email || 'Select...'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View style={styles.verticalDivider} />

                            <TouchableOpacity style={styles.filterBtn} onPress={() => setShowDatePicker(true)}>
                                <Octicons name="calendar" size={12} color="#94a3b8" />
                                <View style={{ marginLeft: 6, flex: 1 }}>
                                    <Text style={styles.filterLabel}>Date</Text>
                                    <Text style={styles.filterText} numberOfLines={1}>
                                        {selectedDate?.label || 'Select...'}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View style={styles.verticalDivider} />

                            <TouchableOpacity style={[styles.filterBtn, { flex: 1.3 }]} onPress={() => setShowTimePicker(true)}>
                                <Octicons name="clock" size={12} color="#94a3b8" />
                                <View style={{ marginLeft: 6, flex: 1 }}>
                                    <Text style={styles.filterLabel}>Time</Text>
                                    <Text style={styles.filterText} numberOfLines={1}>
                                        {startTime && endTime ? `${startTime}-${endTime}` : 'All Day'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </GroupSelector>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Map */}
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{ latitude: myLocation.coords.latitude, longitude: myLocation.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            >
                {locations.length > 1 && (
                    <Polyline
                        coordinates={locations.map(l => ({ latitude: l.latitude, longitude: l.longitude }))}
                        strokeColor="#3B82F6"
                        strokeWidth={4}
                    />
                )}
                {/* Start */}
                {locations[0] && (
                    <Marker coordinate={{ latitude: locations[0].latitude, longitude: locations[0].longitude }} zIndex={5} anchor={{ x: 0.5, y: 1 }}>
                        <FontAwesome5 name="map-marker-alt" size={32} color="#22c55e" />
                    </Marker>
                )}
                {/* End */}
                {locations.length > 1 && (
                    <Marker coordinate={{ latitude: locations[locations.length - 1].latitude, longitude: locations[locations.length - 1].longitude }} zIndex={5} anchor={{ x: 0.5, y: 1 }}>
                        <FontAwesome5 name="map-marker-alt" size={32} color="#ef4444" />
                    </Marker>
                )}
                {/* Current */}
                {currentPoint && (
                    <Marker coordinate={{ latitude: currentPoint.latitude, longitude: currentPoint.longitude }} zIndex={10} anchor={{ x: 0.5, y: 1 }}>
                        <FontAwesome5 name="map-marker-alt" size={40} color="#000000" />
                    </Marker>
                )}
            </MapView>

            {/* Playback Controls */}
            {locations.length > 1 && (
                <PlaybackControls
                    isPlaying={isPlaying}
                    currentSeconds={currentPoint ? getSecondsFromMidnight(currentPoint.timestamp) : 0}
                    activeSegments={activeSegments}
                    onTogglePlay={() => setIsPlaying(!isPlaying)}
                    onStepBack={() => {
                        setIsPlaying(false);
                        setCurrentPointIndex(prev => Math.max(0, prev - 1));
                    }}
                    onStepForward={() => {
                        setIsPlaying(false);
                        setCurrentPointIndex(prev => Math.min(locations.length - 1, prev + 1));
                    }}
                    currentTimeLabel={formatTime(currentPoint?.timestamp)}
                    timeRangeStart={timeRangeStart}
                    timeRangeEnd={timeRangeEnd}
                    totalPoints={locations.length}
                    currentPointIndex={currentPointIndex}
                />
            )}

            {/* No locations message */}
            {selectedMember && selectedDate && locations.length === 0 && (
                <View style={styles.noDataContainer}>
                    <FontAwesome5 name="map-marked-alt" size={32} color="#64748b" />
                    <Text style={styles.noDataText}>No locations found for this filter</Text>
                    <Text style={styles.noDataSubtext}>
                        Try selecting a different date or time range
                    </Text>
                </View>
            )}

            {/* Modals */}
            <Modal visible={showMemberPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Member</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {members.map(m => (
                                <TouchableOpacity key={m.id} style={styles.modalItem} onPress={() => { setSelectedMember(m); setShowMemberPicker(false); }}>
                                    <Text style={styles.modalText}>{m.name || m.email}</Text>
                                    {selectedMember?.id === m.id && <Octicons name="check" size={16} color="#3b82f6" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowMemberPicker(false)} style={styles.closeBtn}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={showDatePicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Date</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {dateOptions.map(d => (
                                <TouchableOpacity key={d.value} style={styles.modalItem} onPress={() => { setSelectedDate(d); setShowDatePicker(false); }}>
                                    <Text style={styles.modalText}>{d.label}</Text>
                                    {selectedDate?.value === d.value && <Octicons name="check" size={16} color="#3b82f6" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.closeBtn}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <TimeRangePickerModal
                visible={showTimePicker}
                onClose={() => setShowTimePicker(false)}
                onApply={(start, end) => {
                    if (start && end) {
                        setStartTime(start);
                        setEndTime(end);
                    } else {
                        setStartTime(null);
                        setEndTime(null);
                    }
                }}
                initialStartTime={startTime || undefined}
                initialEndTime={endTime || undefined}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, right: 0, zIndex: 50,
        flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16
    },
    backButton: {
        padding: 8, backgroundColor: '#1e293b', borderRadius: 20, marginRight: 12, marginTop: 4,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, elevation: 4
    },
    filterRow: {
        flexDirection: 'row',
        paddingVertical: 8,
    },
    filterBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        overflow: 'hidden',
    },
    verticalDivider: {
        width: 1,
        backgroundColor: '#334155',
        marginVertical: 4
    },
    filterLabel: {
        fontSize: 10,
        color: '#94a3b8',
        textTransform: 'uppercase',
        fontWeight: 'bold',
        marginBottom: 2
    },
    filterText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    map: { flex: 1 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16, textAlign: 'center' },
    modalItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#334155', borderRadius: 8, marginBottom: 8 },
    modalText: { color: '#fff' },
    closeBtn: { marginTop: 16, alignItems: 'center', padding: 12 },
    closeText: { color: '#94a3b8' },

    // No data message
    noDataContainer: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    noDataText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
        textAlign: 'center',
    },
    noDataSubtext: {
        color: '#94a3b8',
        fontSize: 13,
        marginTop: 6,
        textAlign: 'center',
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
});
