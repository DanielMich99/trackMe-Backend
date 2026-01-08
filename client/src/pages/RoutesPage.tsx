import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

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
}

export default function RoutesPage() {
    const navigate = useNavigate();
    const activeGroupId = useAuthStore((state) => state.activeGroupId);
    const groups = useAuthStore((state) => state.groups);

    const [members, setMembers] = useState<GroupMember[]>([]);
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [locations, setLocations] = useState<LocationPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [sliderValue, setSliderValue] = useState<number>(0);

    const activeGroup = groups.find(g => g.id === activeGroupId) as any;

    // Generate last 7 days options
    const dateOptions = useMemo(() => {
        const dates: { value: string; label: string }[] = [];
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

    // Load group members from cached group data
    useEffect(() => {
        if (!activeGroupId || !activeGroup) {
            setMembers([]);
            return;
        }

        // The users array is already in the group from my-groups API
        if (activeGroup.users) {
            setMembers(activeGroup.users.map((u: any) => ({
                id: u.id,
                name: u.name || u.email || u.id,
            })));
        }
    }, [activeGroupId, activeGroup]);

    // Load history when selection changes
    useEffect(() => {
        if (!selectedMemberId || !selectedDate || !activeGroupId) {
            setLocations([]);
            return;
        }

        setLoading(true);
        api.get(`/location/history/${selectedMemberId}?groupId=${activeGroupId}&date=${selectedDate}`)
            .then(res => {
                setLocations(res.data);
                setSliderValue(0);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [selectedMemberId, selectedDate, activeGroupId]);

    // Get route as array of [lat, lng] for Polyline
    const routePositions = useMemo(() => {
        return locations.map(loc => [loc.latitude, loc.longitude] as [number, number]);
    }, [locations]);

    // Get start and end points
    const startPoint = locations[0];
    const endPoint = locations[locations.length - 1];

    // Get current point based on slider
    const currentPoint = locations[sliderValue];

    // Format time for display
    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Calculate map center
    const mapCenter = useMemo((): [number, number] => {
        if (currentPoint) {
            return [currentPoint.latitude, currentPoint.longitude];
        }
        if (startPoint) {
            return [startPoint.latitude, startPoint.longitude];
        }
        return [32.00, 34.945]; // Default: Shoham
    }, [currentPoint, startPoint]);

    return (
        <div className="h-screen w-screen flex bg-slate-900 text-white">
            {/* Left Panel - Controls */}
            <div className="w-96 bg-slate-800 p-4 overflow-y-auto border-r border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={() => navigate('/map')}
                        className="text-slate-400 hover:text-white text-sm"
                    >
                        ← Back to Map
                    </button>
                </div>

                <h1 className="text-2xl font-bold mb-2">📍 Route History</h1>
                <p className="text-slate-400 text-sm mb-6">
                    {activeGroup ? activeGroup.name : 'Select a group from the map'}
                </p>

                {/* Member Selector */}
                <div className="mb-4">
                    <label className="block text-sm text-slate-400 mb-1">Select Member</label>
                    <select
                        value={selectedMemberId}
                        onChange={(e) => setSelectedMemberId(e.target.value)}
                        className="w-full p-2 rounded bg-slate-700 border border-slate-600"
                    >
                        <option value="">Choose a member...</option>
                        {members.map(m => (
                            <option key={m.id} value={m.id}>{m.name || m.id}</option>
                        ))}
                    </select>
                </div>

                {/* Date Selector */}
                <div className="mb-6">
                    <label className="block text-sm text-slate-400 mb-1">Select Date</label>
                    <select
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full p-2 rounded bg-slate-700 border border-slate-600"
                        disabled={!selectedMemberId}
                    >
                        <option value="">Choose a date...</option>
                        {dateOptions.map(d => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                    </select>
                </div>

                {/* Results */}
                {loading ? (
                    <p className="text-slate-400">Loading...</p>
                ) : locations.length === 0 && selectedMemberId && selectedDate ? (
                    <div className="bg-slate-700 p-4 rounded text-center">
                        <p className="text-slate-400">No locations found for this date</p>
                    </div>
                ) : locations.length > 0 ? (
                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="bg-slate-700 p-3 rounded">
                            <p className="text-sm">
                                <span className="text-slate-400">Total points:</span> {locations.length}
                            </p>
                            {startPoint && (
                                <p className="text-sm">
                                    <span className="text-slate-400">Start:</span> {formatTime(startPoint.timestamp)}
                                </p>
                            )}
                            {endPoint && (
                                <p className="text-sm">
                                    <span className="text-slate-400">End:</span> {formatTime(endPoint.timestamp)}
                                </p>
                            )}
                        </div>

                        {/* Time Slider */}
                        <div className="bg-slate-700 p-4 rounded">
                            <label className="block text-sm text-slate-400 mb-2">
                                Time: {currentPoint ? formatTime(currentPoint.timestamp) : '--:--'}
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={locations.length - 1}
                                value={sliderValue}
                                onChange={(e) => setSliderValue(parseInt(e.target.value))}
                                className="w-full accent-blue-500"
                            />
                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                <span>{startPoint ? formatTime(startPoint.timestamp) : ''}</span>
                                <span>{endPoint ? formatTime(endPoint.timestamp) : ''}</span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="text-xs text-slate-400 space-y-1">
                            <p><span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>Start point</p>
                            <p><span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2"></span>End point</p>
                            <p><span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2"></span>Current position</p>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Right Panel - Map */}
            <div className="flex-1">
                <MapContainer
                    center={mapCenter}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Route Polyline */}
                    {routePositions.length >= 2 && (
                        <Polyline
                            positions={routePositions}
                            pathOptions={{
                                color: '#3B82F6',
                                weight: 3,
                                opacity: 0.7,
                            }}
                        />
                    )}

                    {/* Start Point (Green) */}
                    {startPoint && (
                        <CircleMarker
                            center={[startPoint.latitude, startPoint.longitude]}
                            radius={3}
                            pathOptions={{
                                color: '#22C55E',
                                fillColor: '#22C55E',
                                fillOpacity: 0,
                            }}
                        >
                            <Popup>Start: {formatTime(startPoint.timestamp)}</Popup>
                        </CircleMarker>
                    )}

                    {/* End Point (Red) */}
                    {endPoint && locations.length > 1 && (
                        <CircleMarker
                            center={[endPoint.latitude, endPoint.longitude]}
                            radius={3}
                            pathOptions={{
                                color: '#EF4444',
                                fillColor: '#EF4444',
                                fillOpacity: 0,
                            }}
                        >
                            <Popup>End: {formatTime(endPoint.timestamp)}</Popup>
                        </CircleMarker>
                    )}

                    {/* Current Position from Slider (Blue) */}
                    {currentPoint && (
                        <CircleMarker
                            center={[currentPoint.latitude, currentPoint.longitude]}
                            radius={4}
                            pathOptions={{
                                color: '#3B82F6',
                                fillColor: '#3B82F6',
                                fillOpacity: 0,
                                weight: 3,
                            }}
                        >
                            <Popup>{formatTime(currentPoint.timestamp)}</Popup>
                        </CircleMarker>
                    )}
                </MapContainer>
            </div>
        </div>
    );
}
