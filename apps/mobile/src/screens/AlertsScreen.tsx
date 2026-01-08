import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    Alert,
    Animated,
    RefreshControl,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { Octicons } from '@expo/vector-icons';

// --- Types ---

interface AlertItem {
    id: number;
    userName: string;
    areaName: string;
    type: 'DANGER_ZONE_ENTER' | 'DANGER_ZONE_LEAVE' | 'SAFE_ZONE_ENTER' | 'SAFE_ZONE_LEAVE' | 'SOS_ALERT';
    createdAt: string;
}

// --- Hooks ---

const useAlerts = (groupId: string | null) => {
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchAlerts = async (pageNum: number, refresh = false) => {
        if (!groupId) return;
        try {
            const res = await api.get(`/alerts/group/${groupId}?page=${pageNum}&limit=20`);
            const newAlerts = res.data.alerts;

            if (refresh) {
                setAlerts(newAlerts);
            } else {
                setAlerts(prev => [...prev, ...newAlerts]);
            }

            setHasMore(newAlerts.length >= 20); // Assuming limit is 20
        } catch (error) {
            console.error('Failed to fetch alerts', error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        setPage(1);
        setHasMore(true);
        setLoading(true);
        fetchAlerts(1, true);
    }, [groupId]);

    const refresh = useCallback(() => {
        setIsRefreshing(true);
        setPage(1);
        setHasMore(true);
        fetchAlerts(1, true);
    }, [groupId]);

    const loadMore = useCallback(() => {
        if (!hasMore || isLoadingMore || loading) return;
        setIsLoadingMore(true);
        const nextPage = page + 1;
        setPage(nextPage);
        fetchAlerts(nextPage);
    }, [page, hasMore, isLoadingMore, loading, groupId]);

    const deleteAlert = useCallback(async (id: number) => {
        // Optimistic update
        const previousAlerts = [...alerts];
        setAlerts(prev => prev.filter(a => a.id !== id));

        try {
            await api.delete(`/alerts/${id}`);
        } catch (err) {
            console.error('Failed to delete alert', err);
            Alert.alert('Error', 'Failed to delete alert');
            setAlerts(previousAlerts); // Rollback
        }
    }, [alerts]);

    return {
        alerts,
        loading,
        isRefreshing,
        isLoadingMore,
        refresh,
        loadMore,
        deleteAlert
    };
};

// --- Helper Functions ---

const formatExactTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
};

// --- Sub-Components ---

const AlertRow = ({ item, onDelete }: { item: AlertItem, onDelete: (id: number) => void }) => {
    const isSafe = item.type.includes('SAFE');
    const isSos = item.type === 'SOS_ALERT';

    let borderStyle = {};
    if (isSos) borderStyle = styles.sosBorder;
    else if (isSafe) borderStyle = styles.safeBorder;
    else borderStyle = styles.dangerBorder;

    let title = '';
    let description = '';
    let titleColor = styles.userName;

    if (isSos) {
        title = 'SOS ALERT';
        description = `Distress signal from ${item.userName}`;
        titleColor = styles.sosTitle;
    } else {
        title = item.userName;
        const action = item.type.includes('ENTER') ? 'entered' : 'left';
        description = `${action} ${item.areaName}`;
    }

    const renderRightActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const trans = dragX.interpolate({
            inputRange: [-100, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });

        return (
            <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteAction}>
                <Animated.View style={[styles.deleteActionContent, { transform: [{ scale: trans }] }]}>
                    <Octicons name="trash" size={24} color="#FFF" />
                    <Text style={styles.deleteText}>Delete</Text>
                </Animated.View>
            </TouchableOpacity>
        );
    };

    return (
        <Swipeable renderRightActions={renderRightActions}>
            <View style={[styles.alertItem, borderStyle, isSos && styles.sosBackground]}>
                <View style={styles.alertContent}>
                    {isSos && <Octicons name="alert" size={24} color="#ef4444" style={{ marginRight: 12 }} />}
                    <View style={styles.alertText}>
                        <Text style={titleColor}>{title}</Text>
                        <Text style={styles.actionText}>{description}</Text>
                    </View>
                </View>
                <Text style={styles.timeText}>{formatExactTime(item.createdAt)}</Text>
            </View>
        </Swipeable>
    );
};

// --- Main Component ---

export default function AlertsScreen({ onBack }: { onBack: () => void }) {
    const activeGroupId = useAuthStore((state) => state.activeGroupId);
    const { alerts, loading, isRefreshing, isLoadingMore, refresh, loadMore, deleteAlert } = useAlerts(activeGroupId);

    return (
        <GestureHandlerRootView style={styles.container}>
            <View style={styles.header}>
                <View style={{ width: 24 }}>
                    {/* Placeholder for center alignment if we add a back button here later, 
                        though the prop exists it's not in the original header UI 
                     */}
                </View>
                <Text style={styles.title}>Alert History</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading && alerts.length === 0 ? (
                <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
            ) : alerts.length === 0 ? (
                <View style={styles.empty}>
                    <Octicons name="bell" size={48} color="#334155" style={{ marginBottom: 16 }} />
                    <Text style={styles.emptyText}>No alerts yet</Text>
                    <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
                        <Text style={styles.retryText}>Refresh</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={alerts}
                    renderItem={({ item }) => <AlertRow item={item} onDelete={deleteAlert} />}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#3b82f6" />
                    }
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        isLoadingMore ? <ActivityIndicator size="small" color="#94a3b8" style={{ marginVertical: 16 }} /> : null
                    }
                />
            )}
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        backgroundColor: '#1e293b',
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    loader: { flex: 1, justifyContent: 'center' },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyText: { color: '#64748b', fontSize: 16, marginBottom: 16 },
    retryBtn: { padding: 8 },
    retryText: { color: '#3b82f6' },

    list: { padding: 16 },

    alertItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
    },
    dangerBorder: { borderLeftColor: '#ef4444' },
    safeBorder: { borderLeftColor: '#22c55e' },
    sosBorder: { borderLeftColor: '#dc2626', borderLeftWidth: 6 },
    sosBackground: { backgroundColor: '#2f1515' },
    sosTitle: { fontSize: 16, fontWeight: 'bold', color: '#ef4444', textTransform: 'uppercase' },

    alertContent: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
    alertText: { flex: 1 },
    userName: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
    actionText: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
    timeText: { color: '#64748b', fontSize: 11 },

    deleteAction: {
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '100%',
        borderRadius: 12,
        marginBottom: 12, // Match alertItem margin
        marginLeft: 8,
    },
    deleteActionContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 10,
        marginTop: 4,
    },
});
