import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { MapContainer, TileLayer, Polygon, Popup, useMapEvents, CircleMarker, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

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

interface Group {
    id: string;
    name: string;
    users: { id: string; name: string }[];
}

// Drag handler for drawing lines between points
function DragDrawHandler({
    points,
    onPointAdded,
    isDragging,
    setIsDragging,
    dragStart,
    setDragStart,
    dragEnd,
    setDragEnd,
}: {
    points: [number, number][];
    onPointAdded: (lat: number, lng: number) => void;
    isDragging: boolean;
    setIsDragging: (v: boolean) => void;
    dragStart: [number, number] | null;
    setDragStart: (v: [number, number] | null) => void;
    dragEnd: [number, number] | null;
    setDragEnd: (v: [number, number] | null) => void;
}) {
    const map = useMapEvents({
        click: (e) => {
            // First point - just click anywhere
            if (points.length === 0) {
                onPointAdded(e.latlng.lat, e.latlng.lng);
            }
        },
        mousemove: (e) => {
            if (isDragging && dragStart) {
                setDragEnd([e.latlng.lat, e.latlng.lng]);
            }
        },
        mouseup: (e) => {
            if (isDragging && dragStart) {
                onPointAdded(e.latlng.lat, e.latlng.lng);
                setIsDragging(false);
                setDragStart(null);
                setDragEnd(null);
                // Re-enable map dragging
                map.dragging.enable();
            }
        },
    });

    // Function to start drag and disable map panning
    const startDrag = useCallback((point: [number, number]) => {
        map.dragging.disable();
        setIsDragging(true);
        setDragStart(point);
        setDragEnd(point);
    }, [map, setIsDragging, setDragStart, setDragEnd]);

    // Expose startDrag through a ref that can be accessed
    useEffect(() => {
        (window as any).__startPolygonDrag = startDrag;
        return () => {
            delete (window as any).__startPolygonDrag;
        };
    }, [startDrag]);

    return null;
}

export default function AreasPage() {
    const navigate = useNavigate();
    const activeGroupId = useAuthStore((state) => state.activeGroupId);

    const [areas, setAreas] = useState<Area[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedArea, setSelectedArea] = useState<Area | null>(null);
    const [loading, setLoading] = useState(true);

    // Drawing mode
    const [isDrawing, setIsDrawing] = useState(false);
    const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
    const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<[number, number] | null>(null);
    const [dragEnd, setDragEnd] = useState<[number, number] | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formGroupId, setFormGroupId] = useState('');
    const [formType, setFormType] = useState<'DANGER' | 'SAFE'>('DANGER');
    const [formTargetUserId, setFormTargetUserId] = useState<string>('');
    const [formAlertOn, setFormAlertOn] = useState<'ENTER' | 'LEAVE' | 'BOTH'>('ENTER');

    // Load groups
    useEffect(() => {
        api.get('/groups/my-groups')
            .then(res => {
                setGroups(res.data.filter((g: any) => g.myStatus === 'APPROVED'));
            })
            .catch(console.error);
    }, []);

    // Load areas for active group
    useEffect(() => {
        if (!activeGroupId) {
            setAreas([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        api.get(`/areas/group/${activeGroupId}`)
            .then(res => {
                setAreas(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [activeGroupId]);

    const startDrawing = () => {
        setEditingAreaId(null);
        setFormName('');
        setFormGroupId(activeGroupId || '');
        setFormType('DANGER');
        setFormTargetUserId('');
        setFormAlertOn('ENTER');
        setDrawnPoints([]);
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
        setIsDrawing(true);
    };

    const startEditing = (area: Area) => {
        setEditingAreaId(area.id);
        setFormName(area.name);
        setFormGroupId(area.groupId);
        setFormType(area.type);
        setFormTargetUserId(area.targetUserId || '');
        setFormAlertOn(area.alertOn);

        // Convert polygon coordinates [lng, lat] to [lat, lng] for display
        const points: [number, number][] = area.polygon?.coordinates?.[0]?.map(
            ([lng, lat]) => [lat, lng] as [number, number]
        ) || [];
        // Remove the closing point if it's the same as the first
        if (points.length > 1 &&
            points[0][0] === points[points.length - 1][0] &&
            points[0][1] === points[points.length - 1][1]) {
            points.pop();
        }
        setDrawnPoints(points);

        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
        setIsDrawing(true);
    };

    const cancelDrawing = () => {
        setIsDrawing(false);
        setEditingAreaId(null);
        setDrawnPoints([]);
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
    };

    const handlePointAdded = useCallback((lat: number, lng: number) => {
        setDrawnPoints(prev => [...prev, [lat, lng]]);
    }, []);

    const removeLastPoint = () => {
        setDrawnPoints(prev => prev.slice(0, -1));
    };

    // Start dragging from a vertex - uses function exposed by DragDrawHandler
    const handleVertexMouseDown = (point: [number, number]) => {
        const startDrag = (window as any).__startPolygonDrag;
        if (startDrag) {
            startDrag(point);
        }
    };

    const handleDelete = async (areaId: number) => {
        if (!confirm('Are you sure you want to delete this area?')) return;
        try {
            await api.delete(`/areas/${areaId}`);
            setAreas(areas.filter(a => a.id !== areaId));
            if (selectedArea?.id === areaId) setSelectedArea(null);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSave = async () => {
        if (!formName || !formGroupId) {
            alert('Please fill in name and select a group');
            return;
        }

        if (drawnPoints.length < 3) {
            alert('Please add at least 3 points to create an area');
            return;
        }

        // Convert [lat, lng] to [lng, lat] for GeoJSON
        const coordinates = drawnPoints.map(([lat, lng]) => [lng, lat]);

        const payload = {
            name: formName,
            groupId: formGroupId,
            type: formType,
            targetUserId: formTargetUserId || null,
            alertOn: formAlertOn,
            coordinates,
        };

        try {
            if (editingAreaId) {
                // Update existing area
                const res = await api.put(`/areas/${editingAreaId}`, payload);
                setAreas(areas.map(a => a.id === editingAreaId ? res.data : a));
            } else {
                // Create new area
                const res = await api.post('/areas', payload);
                setAreas([...areas, res.data]);
            }
            setIsDrawing(false);
            setEditingAreaId(null);
            setDrawnPoints([]);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to save area');
        }
    };

    // Get polygon coordinates for Leaflet (swap lng/lat to lat/lng)
    const getPolygonPositions = (area: Area): [number, number][] => {
        if (!area.polygon?.coordinates?.[0]) return [];
        return area.polygon.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
    };

    const activeGroup = groups.find(g => g.id === activeGroupId);

    // Drawing mode view
    if (isDrawing) {
        return (
            <div className="h-screen w-screen flex bg-slate-900 text-white">
                {/* Left panel - Form */}
                <div className="w-96 bg-slate-800 p-4 overflow-y-auto border-r border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={cancelDrawing}
                            className="text-slate-400 hover:text-white text-sm"
                        >
                            ← Cancel
                        </button>
                    </div>

                    <h1 className="text-2xl font-bold mb-4">
                        {editingAreaId ? '✏️ Edit Area' : '🎨 Draw Danger Zone'}
                    </h1>

                    <div className="space-y-4">
                        <div className={`p-3 rounded ${drawnPoints.length >= 3 ? 'bg-green-900/30 border border-green-500' : 'bg-yellow-900/30 border border-yellow-500'}`}>
                            <p className="text-sm font-bold">
                                {drawnPoints.length === 0
                                    ? '👆 Click on map to add first point'
                                    : drawnPoints.length >= 3
                                        ? `✅ ${drawnPoints.length} points - Ready to save!`
                                        : `📍 ${drawnPoints.length} points - Drag from a vertex to add more`}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                {drawnPoints.length > 0 && 'Hold mouse on a vertex and drag to add new point'}
                            </p>
                            {drawnPoints.length > 0 && (
                                <button
                                    onClick={removeLastPoint}
                                    className="text-xs text-red-400 hover:text-red-300 mt-2"
                                >
                                    ↩ Undo last point
                                </button>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Name</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="w-full p-2 rounded bg-slate-700 border border-slate-600"
                                placeholder="e.g., Busy Highway"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Group</label>
                            <select
                                value={formGroupId}
                                onChange={(e) => setFormGroupId(e.target.value)}
                                className="w-full p-2 rounded bg-slate-700 border border-slate-600"
                            >
                                <option value="">Select group...</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Type</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={formType === 'DANGER'}
                                        onChange={() => setFormType('DANGER')}
                                    />
                                    <span className="text-red-400">🚫 Danger</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={formType === 'SAFE'}
                                        onChange={() => setFormType('SAFE')}
                                    />
                                    <span className="text-green-400">✅ Safe</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Target Member</label>
                            <select
                                value={formTargetUserId}
                                onChange={(e) => setFormTargetUserId(e.target.value)}
                                className="w-full p-2 rounded bg-slate-700 border border-slate-600"
                            >
                                <option value="">All members</option>
                                {activeGroup?.users?.map(u => (
                                    <option key={u.id} value={u.id}>{u.name || u.id}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Alert On</label>
                            <select
                                value={formAlertOn}
                                onChange={(e) => setFormAlertOn(e.target.value as any)}
                                className="w-full p-2 rounded bg-slate-700 border border-slate-600"
                            >
                                <option value="ENTER">Enter zone</option>
                                <option value="LEAVE">Leave zone</option>
                                <option value="BOTH">Both</option>
                            </select>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={drawnPoints.length < 3 || !formName || !formGroupId}
                            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white py-3 rounded font-bold mt-4"
                        >
                            Save Danger Zone
                        </button>
                    </div>
                </div>

                {/* Right panel - Map for drawing */}
                <div className="flex-1">
                    <MapContainer
                        center={[32.00, 34.945]}
                        zoom={14}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <DragDrawHandler
                            points={drawnPoints}
                            onPointAdded={handlePointAdded}
                            isDragging={isDragging}
                            setIsDragging={setIsDragging}
                            dragStart={dragStart}
                            setDragStart={setDragStart}
                            dragEnd={dragEnd}
                            setDragEnd={setDragEnd}
                        />

                        {/* Show dragging line preview */}
                        {isDragging && dragStart && dragEnd && (
                            <Polyline
                                positions={[dragStart, dragEnd]}
                                pathOptions={{
                                    color: '#FF0000',
                                    weight: 2,
                                    dashArray: '5, 10',
                                }}
                            />
                        )}

                        {/* Show lines between consecutive points */}
                        {drawnPoints.length >= 2 && (
                            <Polyline
                                positions={drawnPoints}
                                pathOptions={{
                                    color: formType === 'DANGER' ? 'red' : 'green',
                                    weight: 2,
                                    interactive: false,
                                }}
                            />
                        )}

                        {/* Show markers for each clicked point - draggable */}
                        {drawnPoints.map((point, index) => (
                            <CircleMarker
                                key={index}
                                center={point}
                                radius={12}
                                pathOptions={{
                                    color: index === 0 ? '#FFD700' : '#FF0000',
                                    fillColor: index === 0 ? '#FFD700' : '#FF0000',
                                    fillOpacity: 1,
                                    weight: 3,
                                }}
                                eventHandlers={{
                                    mousedown: () => handleVertexMouseDown(point),
                                }}
                            />
                        ))}

                        {/* Show filled polygon preview after 3+ points */}
                        {drawnPoints.length >= 3 && (
                            <Polygon
                                positions={drawnPoints}
                                pathOptions={{
                                    color: formType === 'DANGER' ? 'red' : 'green',
                                    fillColor: formType === 'DANGER' ? 'red' : 'green',
                                    fillOpacity: 0.3,
                                    interactive: false,
                                }}
                            />
                        )}
                    </MapContainer>
                </div>
            </div>
        );
    }

    // Normal view
    return (
        <div className="h-screen w-screen flex bg-slate-900 text-white">
            {/* Left Panel - Areas List */}
            <div className="w-96 bg-slate-800 p-4 overflow-y-auto border-r border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={() => navigate('/map')}
                        className="text-slate-400 hover:text-white text-sm"
                    >
                        ← Back to Map
                    </button>
                </div>

                <h1 className="text-2xl font-bold mb-4">⚠️ Danger Zones</h1>

                {/* Group selector info */}
                <div className="bg-slate-700 p-3 rounded mb-4">
                    <p className="text-sm text-slate-400">Viewing areas for:</p>
                    <p className="font-bold">{activeGroup?.name || 'No group selected'}</p>
                    <p className="text-xs text-slate-500 mt-1">Select a group from the map page</p>
                </div>

                {/* Create button */}
                <button
                    onClick={startDrawing}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold mb-4"
                    disabled={!activeGroupId}
                >
                    + Draw New Danger Zone
                </button>

                {/* Areas list */}
                {loading ? (
                    <p className="text-slate-400">Loading...</p>
                ) : areas.length === 0 ? (
                    <p className="text-slate-400 text-sm">No danger zones defined yet.</p>
                ) : (
                    <div className="space-y-2">
                        {areas.map(area => (
                            <div
                                key={area.id}
                                onClick={() => setSelectedArea(area)}
                                className={`p-3 rounded cursor-pointer border transition ${selectedArea?.id === area.id
                                    ? 'bg-red-900/30 border-red-500'
                                    : 'bg-slate-700 border-slate-600 hover:border-slate-500'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{area.name}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${area.type === 'DANGER' ? 'bg-red-600' : 'bg-green-600'
                                        }`}>
                                        {area.type}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    Alert on: {area.alertOn} |
                                    Target: {area.targetUserId ? 'Specific member' : 'All members'}
                                </p>
                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); startEditing(area); }}
                                        className="text-xs text-blue-400 hover:text-blue-300"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(area.id); }}
                                        className="text-xs text-red-400 hover:text-red-300"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Right Panel - Map with selected area */}
            <div className="flex-1">
                <MapContainer
                    center={[32.00, 34.945]}
                    zoom={14}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Show selected area polygon */}
                    {selectedArea && (
                        <Polygon
                            positions={getPolygonPositions(selectedArea)}
                            pathOptions={{
                                color: selectedArea.type === 'DANGER' ? 'red' : 'green',
                                fillColor: selectedArea.type === 'DANGER' ? 'red' : 'green',
                                fillOpacity: 0.3,
                            }}
                        >
                            <Popup>{selectedArea.name}</Popup>
                        </Polygon>
                    )}
                </MapContainer>
            </div>
        </div>
    );
}
