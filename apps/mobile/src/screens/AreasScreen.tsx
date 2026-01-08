import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { socketManager } from '../lib/socket';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    ScrollView,
    Modal,
    TextInput,
    Alert,
    KeyboardAvoidingView,
} from 'react-native';
import MapView, { Polygon, Marker, MapPressEvent, Region } from 'react-native-maps';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { Octicons } from '@expo/vector-icons';
import { GroupSelector } from '../components/GroupSelector';

// --- Types ---
interface Area {
    id: number;
    name: string;
    groupId: string;
    type: 'SAFE' | 'DANGER';
    targetUserId: string | null;
    alertOn: 'ENTER' | 'LEAVE' | 'BOTH';
    polygon: {
        type: string;
        coordinates: number[][][];
    };
}

interface GroupMember {
    id: string;
    name: string;
    email: string;
}

// --- Logic Hook ---
const useAreasLogic = () => {
    const { activeGroupId, groups, fetchGroups, setActiveGroup, user } = useAuthStore();
    const activeGroup = useMemo(() => groups.find(g => g.id === activeGroupId), [groups, activeGroupId]);

    const [areas, setAreas] = useState<Area[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAreas = useCallback(async () => {
        if (!activeGroupId) {
            setAreas([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await api.get(`/areas/group/${activeGroupId}`);
            setAreas(res.data);
        } catch {
            console.log('Failed to load areas');
        } finally {
            setLoading(false);
        }
    }, [activeGroupId]);

    useEffect(() => {
        loadAreas();
    }, [loadAreas]);

    const createGroup = async (name: string) => {
        try {
            const res = await api.post('/groups/create', { name });
            if (res.data?.id) {
                socketManager.getSocket()?.emit('joinGroup', { groupId: res.data.id });
            }
            await fetchGroups();
            Alert.alert('Success', 'Group created!');
        } catch {
            Alert.alert('Error', 'Failed to create group');
        }
    };

    const joinGroup = async (code: string) => {
        try {
            await api.post('/groups/join', { joinCode: code.toUpperCase() });
            await fetchGroups();
            socketManager.disconnect();
            socketManager.connect(user?.id || '');
            Alert.alert('Success', 'Joined group!');
        } catch {
            Alert.alert('Error', 'Failed to join group');
        }
    };

    return {
        activeGroup,
        groups,
        setActiveGroup,
        areas,
        loading,
        loadAreas,
        createGroup,
        joinGroup,
        members: activeGroup?.users || [] as GroupMember[],
        activeGroupId
    };
};

// --- Sub-components (Inline for now to avoid file explosion) ---

const AreaMap = ({
    areas,
    isDrawing,
    drawnPoints,
    onMapPress,
    onAreaPress,
    mapRef
}: any) => {
    const getPolygonCoords = (area: Area) => {
        return area.polygon.coordinates[0].map(coord => ({
            latitude: coord[1],
            longitude: coord[0],
        }));
    };

    return (
        <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
                latitude: 32.0,
                longitude: 34.945,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }}
            onPress={onMapPress}
        >
            {areas.map((area: Area) => (
                <Polygon
                    key={area.id}
                    coordinates={getPolygonCoords(area)}
                    fillColor={area.type === 'DANGER' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}
                    strokeColor={area.type === 'DANGER' ? '#ef4444' : '#22c55e'}
                    strokeWidth={2}
                    tappable
                    onPress={() => onAreaPress(area)}
                />
            ))}

            {isDrawing && (
                <>
                    <Polygon
                        coordinates={drawnPoints.length >= 3 ? drawnPoints : [{ latitude: 0, longitude: 0 }, { latitude: 0.000001, longitude: 0 }, { latitude: 0, longitude: 0.000001 }]}
                        fillColor={drawnPoints.length >= 3 ? "rgba(59, 130, 246, 0.3)" : "transparent"}
                        strokeColor={drawnPoints.length >= 3 ? "#3b82f6" : "transparent"}
                        strokeWidth={2}
                        zIndex={1}
                    />
                    {drawnPoints.map((point: any, index: number) => (
                        <Marker key={`point-${index}`} coordinate={point} pinColor="blue" zIndex={2} />
                    ))}
                </>
            )}
        </MapView>
    );
};

// --- Main Screen ---

export default function AreasScreen({ onBack }: { onBack: () => void }) {
    const {
        activeGroup,
        groups,
        setActiveGroup,
        areas,
        loadAreas,
        createGroup,
        joinGroup,
        members,
        activeGroupId
    } = useAreasLogic();

    const mapRef = useRef<MapView>(null);

    // Drawing Logic
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawnPoints, setDrawnPoints] = useState<{ latitude: number; longitude: number }[]>([]);

    // Form Logic
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState<'DANGER' | 'SAFE'>('DANGER');
    const [formTargetUserId, setFormTargetUserId] = useState<string>('');
    const [formAlertOn, setFormAlertOn] = useState<'ENTER' | 'LEAVE' | 'BOTH'>('ENTER');
    const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
    const [showTargetPicker, setShowTargetPicker] = useState(false);

    // Selection
    const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);

    // Handlers
    const startDrawing = () => {
        setIsDrawing(true);
        setDrawnPoints([]);
        setEditingAreaId(null);
        setFormName('');
        setFormType('DANGER');
        setFormTargetUserId('');
        setFormAlertOn('ENTER');
    };

    const handleMapPress = (e: MapPressEvent) => {
        if (!isDrawing) return;
        const coord = e.nativeEvent?.coordinate;
        if (!coord) return;
        setDrawnPoints(prev => [...prev, coord]);
    };

    const finishDrawing = () => {
        if (drawnPoints.length < 3) {
            Alert.alert('Error', 'Draw at least 3 points');
            return;
        }
        setIsDrawing(false);
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            Alert.alert('Error', 'Enter a name');
            return;
        }
        if (!activeGroupId) return;

        const coordinates = drawnPoints.map(p => [p.longitude, p.latitude]);
        coordinates.push([drawnPoints[0].longitude, drawnPoints[0].latitude]);

        const payload = {
            name: formName,
            groupId: activeGroupId,
            type: formType,
            targetUserId: formTargetUserId || null,
            alertOn: formAlertOn,
            coordinates: coordinates,
        };

        try {
            if (editingAreaId) {
                await api.put(`/areas/${editingAreaId}`, payload);
            } else {
                await api.post('/areas', payload);
            }
            Alert.alert('Success', 'Zone saved!');
            setShowForm(false);
            setDrawnPoints([]);
            loadAreas();
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to save');
        }
    };

    const handleDelete = async (areaId: number) => {
        Alert.alert('Delete Zone', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await api.delete(`/areas/${areaId}`);
                    setSelectedAreaId(null);
                    loadAreas();
                }
            }
        ]);
    };

    const handleEdit = (area: Area) => {
        setFormName(area.name);
        setFormType(area.type);
        setFormAlertOn(area.alertOn);
        setFormTargetUserId(area.targetUserId || '');
        setEditingAreaId(area.id);

        const coords = area.polygon.coordinates[0].map(c => ({ latitude: c[1], longitude: c[0] }));
        setDrawnPoints(coords);

        setShowForm(true);
        setSelectedAreaId(null);
    };

    const focusOnArea = (area: Area) => {
        const coords = area.polygon.coordinates[0];
        const lats = coords.map(c => c[1]);
        const lngs = coords.map(c => c[0]);
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        const delta = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs)) * 1.5;

        mapRef.current?.animateToRegion({
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: Math.max(delta, 0.01),
            longitudeDelta: Math.max(delta, 0.01),
        }, 500);
    };

    const getSelectedMemberName = () => {
        if (!formTargetUserId) return 'Everyone';
        const m = members.find((x: any) => x.id === formTargetUserId);
        return m?.name || m?.email || 'Selected Member';
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Octicons name="arrow-left" size={24} color="#3b82f6" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <GroupSelector
                        activeGroup={activeGroup}
                        groups={groups}
                        onSelectGroup={setActiveGroup}
                        onCreateGroup={createGroup}
                        onJoinGroup={joinGroup}
                    />
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* FAB */}
            {!isDrawing && (
                <TouchableOpacity style={styles.fab} onPress={startDrawing}>
                    <Octicons name="plus" size={32} color="#FFF" />
                </TouchableOpacity>
            )}

            {/* Drawing Bar */}
            {isDrawing && (
                <View style={styles.drawingBar}>
                    <Text style={styles.drawingText}>Tap map to add points ({drawnPoints.length})</Text>
                    <View style={styles.drawingActions}>
                        <TouchableOpacity style={styles.undoBtn} onPress={() => setDrawnPoints(p => p.slice(0, -1))}>
                            <Text style={styles.undoBtnText}>↩ Undo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => { setIsDrawing(false); setDrawnPoints([]); }}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.doneBtn} onPress={finishDrawing}>
                            <Text style={styles.doneBtnText}>Done ✓</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <AreaMap
                areas={areas}
                isDrawing={isDrawing}
                drawnPoints={drawnPoints}
                onMapPress={handleMapPress}
                onAreaPress={(area: Area) => {
                    Alert.alert(area.name, `Type: ${area.type}\nAlert on: ${area.alertOn}`, [
                        { text: 'Close' },
                        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(area.id) }
                    ]);
                }}
                mapRef={mapRef}
            />

            {/* Horizontal List */}
            {!isDrawing && (
                <View style={styles.listContainer}>
                    <Text style={styles.listTitle}>Zones ({areas.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                        {areas.map(area => (
                            <TouchableOpacity
                                key={area.id}
                                style={[
                                    styles.areaCard,
                                    area.type === 'DANGER' ? styles.dangerCard : styles.safeCard,
                                    selectedAreaId === area.id && styles.areaCardSelected
                                ]}
                                onPress={() => focusOnArea(area)}
                                onLongPress={() => setSelectedAreaId(area.id)}
                                delayLongPress={400}
                            >
                                <Text style={styles.areaName}>{area.name}</Text>
                                <Text style={styles.areaType}>{area.type === 'DANGER' ? '⚠️' : '✅'} {area.alertOn}</Text>

                                {selectedAreaId === area.id && (
                                    <View style={styles.areaActions}>
                                        <TouchableOpacity style={styles.areaActionBtn} onPress={() => setSelectedAreaId(null)}>
                                            <Text style={styles.areaActionText}>✕</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.areaActionBtn, styles.deleteActionBtn]} onPress={() => handleDelete(area.id)}>
                                            <Text style={styles.areaActionText}>🗑️</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.areaActionBtn, styles.editActionBtn]} onPress={() => handleEdit(area)}>
                                            <Text style={styles.areaActionText}>✏️</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                        {areas.length === 0 && (
                            <Text style={styles.emptyText}>No zones yet. Tap + Add to create one.</Text>
                        )}
                    </ScrollView>
                </View>
            )}

            {/* Form Modal */}
            <Modal visible={showForm} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Zone Details</Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            <Text style={styles.label}>Name</Text>
                            <TextInput style={styles.input} placeholder="e.g. School" placeholderTextColor="#666" value={formName} onChangeText={setFormName} />

                            <Text style={styles.label}>Type</Text>
                            <View style={styles.typeButtons}>
                                <TouchableOpacity style={[styles.typeBtn, formType === 'DANGER' && styles.dangerActive]} onPress={() => setFormType('DANGER')}>
                                    <Text style={styles.typeBtnText}>⚠️ Danger</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.typeBtn, formType === 'SAFE' && styles.safeActive]} onPress={() => setFormType('SAFE')}>
                                    <Text style={styles.typeBtnText}>✅ Safe</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Alert When</Text>
                            <View style={styles.alertButtons}>
                                {(['ENTER', 'LEAVE', 'BOTH'] as const).map(opt => (
                                    <TouchableOpacity key={opt} style={[styles.alertBtn, formAlertOn === opt && styles.alertActive]} onPress={() => setFormAlertOn(opt)}>
                                        <Text style={styles.alertBtnText}>{opt}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Target User</Text>
                            <TouchableOpacity style={styles.targetSelector} onPress={() => setShowTargetPicker(!showTargetPicker)}>
                                <Text style={styles.targetText}>{getSelectedMemberName()} {showTargetPicker ? '▲' : '▼'}</Text>
                            </TouchableOpacity>

                            {showTargetPicker && (
                                <View style={styles.inlinePicker}>
                                    <TouchableOpacity style={[styles.pickerItem, !formTargetUserId && styles.pickerItemActive]} onPress={() => { setFormTargetUserId(''); setShowTargetPicker(false); }}>
                                        <Text style={styles.pickerItemText}>👥 Everyone</Text>
                                    </TouchableOpacity>
                                    {members.map((m: any) => (
                                        <TouchableOpacity key={m.id} style={[styles.pickerItem, formTargetUserId === m.id && styles.pickerItemActive]} onPress={() => { setFormTargetUserId(m.id); setShowTargetPicker(false); }}>
                                            <Text style={styles.pickerItemText}>👤 {m.name || m.email}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.formButtons}>
                            <TouchableOpacity style={styles.cancelFormBtn} onPress={() => { setShowForm(false); setDrawnPoints([]); }}>
                                <Text style={styles.cancelFormText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={styles.saveBtnText}>Save Zone</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, right: 0, zIndex: 10,
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16
    },
    backButton: {
        padding: 8, backgroundColor: '#1e293b', borderRadius: 20, marginRight: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, elevation: 4
    },
    fab: {
        position: 'absolute', bottom: 170, right: 20, width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center', elevation: 6, zIndex: 10
    },
    drawingBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: '#3b82f6', zIndex: 20
    },
    drawingText: { color: '#fff', textAlign: 'center', marginBottom: 8 },
    drawingActions: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
    undoBtn: { padding: 8, backgroundColor: '#1e40af', borderRadius: 6 },
    undoBtnText: { color: '#fff' },
    cancelBtn: { padding: 8, backgroundColor: '#64748b', borderRadius: 6 },
    cancelBtnText: { color: '#fff' },
    doneBtn: { padding: 8, backgroundColor: '#22c55e', borderRadius: 6 },
    doneBtnText: { color: '#fff', fontWeight: 'bold' },
    map: { flex: 1 },
    listContainer: { padding: 12, backgroundColor: '#1e293b', height: 120 },
    listTitle: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
    areaCard: { padding: 12, borderRadius: 8, marginRight: 12, minWidth: 120, justifyContent: 'center' },
    dangerCard: { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444', borderWidth: 1 },
    safeCard: { backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: '#22c55e', borderWidth: 1 },
    areaCardSelected: { borderColor: '#3b82f6', borderWidth: 2, backgroundColor: 'rgba(59, 130, 246, 0.2)' },
    areaName: { color: '#fff', fontWeight: 'bold' },
    areaType: { color: '#94a3b8', fontSize: 12 },
    emptyText: { color: '#64748b', padding: 10 },
    areaActions: { flexDirection: 'row', gap: 4, marginTop: 8 },
    areaActionBtn: { padding: 4, backgroundColor: '#334155', borderRadius: 4, flex: 1, alignItems: 'center' },
    deleteActionBtn: { backgroundColor: 'rgba(239, 68, 68, 0.3)' },
    editActionBtn: { backgroundColor: 'rgba(59, 130, 246, 0.3)' },
    areaActionText: { fontSize: 12 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#1e293b', borderRadius: 12, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 16, textAlign: 'center' },
    label: { color: '#94a3b8', fontSize: 12, marginTop: 12, marginBottom: 6 },
    input: { backgroundColor: '#334155', borderRadius: 8, padding: 12, color: '#fff', fontSize: 16 },
    typeButtons: { flexDirection: 'row', gap: 12 },
    typeBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#334155', alignItems: 'center' },
    dangerActive: { backgroundColor: '#ef4444' },
    safeActive: { backgroundColor: '#22c55e' },
    typeBtnText: { color: '#fff', fontWeight: 'bold' },
    alertButtons: { flexDirection: 'row', gap: 8 },
    alertBtn: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#334155', alignItems: 'center' },
    alertActive: { backgroundColor: '#3b82f6' },
    alertBtnText: { color: '#fff', fontSize: 12 },
    targetSelector: { backgroundColor: '#334155', padding: 12, borderRadius: 8 },
    targetText: { color: '#fff' },
    inlinePicker: { marginTop: 8, maxHeight: 150 },
    pickerItem: { padding: 12, backgroundColor: '#334155', borderRadius: 8, marginBottom: 4 },
    pickerItemActive: { backgroundColor: '#3b82f6' },
    pickerItemText: { color: '#fff' },
    formButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
    cancelFormBtn: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#334155', alignItems: 'center' },
    cancelFormText: { color: '#fff' },
    saveBtn: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#22c55e', alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold' },
});
