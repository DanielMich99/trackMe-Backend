import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

interface Alert {
    id: number;
    groupId: string;
    userId: string;
    userName: string;
    areaId: number;
    areaName: string;
    type: 'DANGER_ZONE_ENTER' | 'DANGER_ZONE_LEAVE';
    createdAt: string;
}

interface AlertsResponse {
    alerts: Alert[];
    total: number;
    page: number;
    pages: number;
}

export default function AlertsPage() {
    const navigate = useNavigate();
    const activeGroupId = useAuthStore((state) => state.activeGroupId);
    const groups = useAuthStore((state) => state.groups);

    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const activeGroup = groups.find(g => g.id === activeGroupId);

    useEffect(() => {
        if (!activeGroupId) {
            setAlerts([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        api.get<AlertsResponse>(`/alerts/group/${activeGroupId}?page=${page}&limit=20`)
            .then(res => {
                setAlerts(res.data.alerts);
                setTotalPages(res.data.pages);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [activeGroupId, page]);

    const formatExactTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigate('/map')}
                        className="text-slate-400 hover:text-white text-sm"
                    >
                        ← Back to Map
                    </button>
                </div>

                <h1 className="text-2xl font-bold mb-2">📋 Alert History</h1>
                <p className="text-slate-400 text-sm mb-6">
                    {activeGroup ? `Showing alerts for ${activeGroup.name}` : 'Select a group from the map'}
                </p>

                {/* Alerts List */}
                {loading ? (
                    <p className="text-slate-400">Loading...</p>
                ) : alerts.length === 0 ? (
                    <div className="bg-slate-800 rounded-lg p-8 text-center">
                        <p className="text-slate-400">No alerts yet</p>
                        <p className="text-slate-500 text-sm mt-2">
                            Alerts will appear here when members enter danger zones
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {alerts.map(alert => {
                            const isLeave = alert.type === 'DANGER_ZONE_LEAVE';
                            return (
                                <div
                                    key={alert.id}
                                    className={`bg-slate-800 rounded-lg p-4 border-l-4 ${isLeave ? 'border-orange-500' : 'border-red-500'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">
                                                {isLeave ? '🚶' : '🚨'}{' '}
                                                <span className={isLeave ? 'text-orange-400' : 'text-red-400'}>
                                                    {alert.userName}
                                                </span>
                                                {isLeave ? ' left danger zone' : ' entered danger zone'}
                                            </p>
                                            <p className="text-slate-400 text-sm mt-1">
                                                Zone: <span className="text-white">{alert.areaName}</span>
                                            </p>
                                        </div>
                                        <span className="text-slate-500 text-xs">
                                            {formatExactTime(alert.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-6">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 bg-slate-700 rounded disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="px-4 py-2 text-slate-400">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 bg-slate-700 rounded disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
