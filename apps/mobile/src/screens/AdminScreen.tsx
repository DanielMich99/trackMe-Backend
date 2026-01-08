import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
} from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

// --- Types ---

interface Member {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'MEMBER';
}

interface PendingRequest {
    id: string;
    userId: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

interface AdminState {
    pendingRequests: PendingRequest[];
    loading: boolean;
    refreshing: boolean;
    activeTab: 'pending' | 'members';
}

// --- Hooks ---

const useAdminLogic = () => {
    const { activeGroupId, groups, fetchGroups, setActiveGroup, user } = useAuthStore();

    // Derived state
    const activeGroup = useMemo(() =>
        groups.find(g => g.id === activeGroupId),
        [groups, activeGroupId]);

    const isAdmin = activeGroup?.myRole === 'ADMIN';

    // Local state
    const [state, setState] = useState<AdminState>({
        pendingRequests: [],
        loading: true,
        refreshing: false,
        activeTab: 'pending',
    });

    // Action loading states (to show spinners on specific buttons)
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

    const loadData = useCallback(async (isRefresh = false) => {
        if (!activeGroupId) return;

        // Only admins can see pending requests
        if (!isAdmin) {
            setState(s => ({ ...s, loading: false, refreshing: false }));
            return;
        }

        if (isRefresh) {
            setState(s => ({ ...s, refreshing: true }));
        } else {
            setState(s => ({ ...s, loading: true }));
        }

        try {
            // We only need to fetch pending requests manually.
            // Members are in the 'activeGroup' object from the store.
            const { data } = await api.get(`/groups/pending?groupId=${activeGroupId}`);
            setState(s => ({ ...s, pendingRequests: data }));

            // Refresh groups to ensure member list is up to date
            if (isRefresh) await fetchGroups();

        } catch (error) {
            console.error('Failed to fetch admin data', error);
        } finally {
            setState(s => ({ ...s, loading: false, refreshing: false }));
        }
    }, [activeGroupId, fetchGroups, isAdmin]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const performAction = async (
        actionName: string,
        endpoint: string,
        targetUserId: string,
        successMessage: string,
        needsConfirmation = false,
        confirmationMessage = ''
    ) => {
        const execute = async () => {
            setProcessingIds(prev => new Set(prev).add(targetUserId));
            try {
                await api.post(endpoint, { groupId: activeGroupId, userId: targetUserId });
                // Optimistic update or refresh
                if (endpoint.includes('approve') || endpoint.includes('reject')) {
                    setState(s => ({
                        ...s,
                        pendingRequests: s.pendingRequests.filter(p => (p.user.id || p.userId) !== targetUserId)
                    }));
                    if (endpoint.includes('approve')) await fetchGroups();
                } else {
                    await fetchGroups();
                }
                // Only show alert for critical actions or if requested, otherwise silent success is often better
                // But for now keeping alerts as user expects them
                if (successMessage) Alert.alert('Success', successMessage);
            } catch (error: any) {
                Alert.alert('Error', error.response?.data?.message || 'Action failed');
            } finally {
                setProcessingIds(prev => {
                    const next = new Set(prev);
                    next.delete(targetUserId);
                    return next;
                });
            }
        };

        if (needsConfirmation) {
            Alert.alert(actionName, confirmationMessage, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', style: 'destructive', onPress: execute }
            ]);
        } else {
            execute();
        }
    };

    return {
        activeGroup,
        isAdmin,
        currentUser: user,
        state,
        setState,
        processingIds,
        actions: {
            refresh: () => loadData(true),
            setActiveGroup,
            approve: (id: string) => performAction('Approve', '/groups/approve', id, 'Member approved!'),
            reject: (id: string) => performAction('Reject', '/groups/reject', id, 'Request rejected'),
            kick: (id: string, name: string) => performAction('Kick Member', '/groups/kick', id, 'Member removed', true, `Are you sure you want to remove ${name}?`),
            promote: (id: string) => performAction('Promote', '/groups/promote', id, 'Member promoted to Admin!'),
            demote: (id: string) => performAction('Demote', '/groups/demote', id, 'Admin demoted to Member'),
        }
    };
};

// --- Sub-Components ---

const PendingRequestItem = ({ item, onApprove, onReject, isProcessing }: {
    item: PendingRequest,
    onApprove: (id: string) => void,
    onReject: (id: string) => void,
    isProcessing: boolean
}) => {
    const userId = item.user?.id || item.userId;
    const name = item.user?.name || item.user?.email || 'Unknown';
    const email = item.user?.email || '';

    return (
        <View style={styles.card}>
            <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{name}</Text>
                {!!email && <Text style={styles.cardEmail}>{email}</Text>}
            </View>
            <View style={styles.cardActions}>
                {isProcessing ? (
                    <ActivityIndicator color="#3b82f6" />
                ) : (
                    <>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.approveBtn]}
                            onPress={() => onApprove(userId)}
                        >
                            <Octicons name="check" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.rejectBtn]}
                            onPress={() => onReject(userId)}
                        >
                            <Octicons name="x" size={20} color="#fff" />
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
    );
};

const MemberItem = ({ item, currentUserId, onPromote, onDemote, onKick, isProcessing }: {
    item: Member,
    currentUserId?: string,
    onPromote: (id: string) => void,
    onDemote: (id: string) => void,
    onKick: (id: string, name: string) => void,
    isProcessing: boolean
}) => {
    const isMe = item.id === currentUserId;
    const isAdmin = item.role === 'ADMIN';

    return (
        <View style={styles.card}>
            <View style={[styles.cardInfo, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.cardName} numberOfLines={1}>
                        {item.name || item.email} {isMe && '(You)'}
                    </Text>
                    {isAdmin && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>ADMIN</Text>
                        </View>
                    )}
                </View>
                {!item.name && <Text style={styles.cardEmail}>{item.email}</Text>}
            </View>

            {!isMe && (
                <View style={styles.roleActions}>
                    {isProcessing ? (
                        <ActivityIndicator size="small" color="#94a3b8" />
                    ) : (
                        <>
                            {isAdmin ? (
                                <ActionButton
                                    label="Demote"
                                    onPress={() => onDemote(item.id)}
                                    variant="neutral"
                                />
                            ) : (
                                <ActionButton
                                    label="Promote"
                                    onPress={() => onPromote(item.id)}
                                    variant="primary"
                                />
                            )}
                            <ActionButton
                                label="Kick"
                                onPress={() => onKick(item.id, item.name || item.email)}
                                variant="danger"
                            />
                        </>
                    )}
                </View>
            )}
        </View>
    );
};

const ActionButton = ({ label, onPress, variant }: { label: string, onPress: () => void, variant: 'primary' | 'danger' | 'neutral' }) => {
    const getStyles = () => {
        switch (variant) {
            case 'primary': return { style: styles.promoteBtn, text: styles.promoteBtnText };
            case 'danger': return { style: styles.kickBtn, text: styles.kickBtnText };
            default: return { style: styles.demoteBtn, text: styles.demoteBtnText };
        }
    };
    const { style, text } = getStyles();
    return (
        <TouchableOpacity style={[styles.compactBtn, style]} onPress={onPress}>
            <Text style={[styles.compactBtnText, text]}>{label}</Text>
        </TouchableOpacity>
    );
};

const GroupSelector = ({ activeGroup, allGroups, onSelect }: { activeGroup: any, allGroups: any[], onSelect: (id: string) => void }) => {
    const [expanded, setExpanded] = useState(false);
    const isAdmin = activeGroup?.myRole === 'ADMIN';

    return (
        <View style={styles.groupCardContainer}>
            {!expanded ? (
                <TouchableOpacity
                    style={styles.expandableCard}
                    onPress={() => setExpanded(true)}
                    activeOpacity={0.9}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.cardIconContainer}>
                            <Octicons name="people" size={16} color="#3b82f6" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <View style={styles.groupNameRow}>
                                <Text style={styles.groupName} numberOfLines={1}>
                                    {activeGroup?.name || 'Select Group'}
                                </Text>
                                <Octicons name="chevron-down" size={16} color="#94a3b8" />
                            </View>
                            <Text style={styles.memberCount}>
                                {isAdmin ? 'Admin Access' : 'View Only'}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            ) : (
                <View style={styles.expandedCard}>
                    <View style={styles.expandedHeader}>
                        <Text style={styles.expandedTitle}>Switch Group</Text>
                        <TouchableOpacity onPress={() => setExpanded(false)} style={{ padding: 4 }}>
                            <Octicons name="x" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                        {allGroups.map(g => (
                            <TouchableOpacity
                                key={g.id}
                                style={[styles.groupItem, g.id === activeGroup?.id && styles.activeGroupItem]}
                                onPress={() => {
                                    onSelect(g.id);
                                    setExpanded(false);
                                }}
                            >
                                <Text style={styles.groupItemText}>{g.name}</Text>
                                {g.id === activeGroup?.id && <Octicons name="check" size={16} color="#3b82f6" />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

// --- Main Component ---

export default function AdminScreen({ onBack }: { onBack: () => void }) {
    const {
        activeGroup,
        isAdmin,
        currentUser,
        state,
        setState,
        processingIds,
        actions
    } = useAdminLogic();

    // We access store directly for the list of groups
    const groups = useAuthStore(s => s.groups);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Octicons name="arrow-left" size={24} color="#3b82f6" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <GroupSelector
                        activeGroup={activeGroup}
                        allGroups={groups}
                        onSelect={actions.setActiveGroup}
                    />
                </View>
                <View style={{ width: 48 }} />
            </View>

            {/* Content */}
            {!isAdmin ? (
                <View style={styles.centerContent}>
                    <Octicons name="shield-lock" size={64} color="#334155" />
                    <Text style={styles.noAccessTitle}>Admin Access Only</Text>
                    <Text style={styles.noAccessText}>
                        You are not an administrator of "{activeGroup?.name}".
                    </Text>
                </View>
            ) : (
                <>
                    <View style={styles.tabs}>
                        <TouchableOpacity
                            style={[styles.tab, state.activeTab === 'pending' && styles.activeTab]}
                            onPress={() => setState(s => ({ ...s, activeTab: 'pending' }))}
                        >
                            <Text style={[styles.tabText, state.activeTab === 'pending' && styles.activeTabText]}>
                                Pending ({state.pendingRequests.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, state.activeTab === 'members' && styles.activeTab]}
                            onPress={() => setState(s => ({ ...s, activeTab: 'members' }))}
                        >
                            <Text style={[styles.tabText, state.activeTab === 'members' && styles.activeTabText]}>
                                Members ({activeGroup?.users?.length || 0})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {state.loading ? (
                        <View style={styles.centerContent}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                        </View>
                    ) : (
                        <FlatList
                            data={state.activeTab === 'pending' ? state.pendingRequests : activeGroup?.users || []}
                            keyExtractor={(item) => item.id || (item as any).userId}
                            contentContainerStyle={styles.listContent}
                            refreshControl={
                                <RefreshControl
                                    refreshing={state.refreshing}
                                    onRefresh={actions.refresh}
                                    tintColor="#3b82f6"
                                />
                            }
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyText}>
                                        {state.activeTab === 'pending' ? 'No pending requests' : 'No members found'}
                                    </Text>
                                </View>
                            }
                            renderItem={({ item }) =>
                                state.activeTab === 'pending' ? (
                                    <PendingRequestItem
                                        item={item as PendingRequest}
                                        onApprove={actions.approve}
                                        onReject={actions.reject}
                                        isProcessing={processingIds.has((item as PendingRequest).user?.id || (item as PendingRequest).userId)}
                                    />
                                ) : (
                                    <MemberItem
                                        item={item as Member}
                                        currentUserId={currentUser?.id}
                                        onPromote={actions.promote}
                                        onDemote={actions.demote}
                                        onKick={actions.kick}
                                        isProcessing={processingIds.has((item as Member).id)}
                                    />
                                )
                            }
                        />
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
        backgroundColor: '#1e293b',
        zIndex: 50,
    },
    backBtn: {
        padding: 8,
        marginRight: 8,
    },

    // Group Selector
    groupCardContainer: { flex: 1 },
    expandableCard: {
        backgroundColor: '#334155',
        borderRadius: 12,
        padding: 10,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center' },
    cardIconContainer: {
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        alignItems: 'center', justifyContent: 'center'
    },
    groupNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    groupName: { color: '#fff', fontSize: 14, fontWeight: 'bold', flex: 1 },
    memberCount: { color: '#94a3b8', fontSize: 10 },

    expandedCard: {
        position: 'absolute', top: 0, left: 0, right: 0,
        backgroundColor: '#334155', borderRadius: 12, padding: 16,
        zIndex: 100, elevation: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8
    },
    expandedHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    expandedTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    groupItem: {
        flexDirection: 'row', justifyContent: 'space-between',
        padding: 12, backgroundColor: '#1e293b', borderRadius: 8, marginBottom: 8
    },
    activeGroupItem: { borderColor: '#3b82f6', borderWidth: 1 },
    groupItemText: { color: '#fff', fontSize: 14 },

    // Tabs
    tabs: { flexDirection: 'row', backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
    tab: { flex: 1, padding: 16, alignItems: 'center' },
    activeTab: { borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
    tabText: { color: '#64748b', fontSize: 14, fontWeight: '500' },
    activeTabText: { color: '#3b82f6', fontWeight: 'bold' },

    // Content
    centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    noAccessTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 16 },
    noAccessText: { color: '#94a3b8', textAlign: 'center', marginTop: 8 },
    listContent: { padding: 16 },
    emptyState: { alignItems: 'center', padding: 32 },
    emptyText: { color: '#64748b' },

    // Cards
    card: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 12
    },
    cardInfo: { flex: 1, marginRight: 12 },
    cardName: { color: '#fff', fontSize: 16, fontWeight: '600' },
    cardEmail: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    cardActions: { flexDirection: 'row', gap: 12 },

    // Member specific
    roleActions: { flexDirection: 'row', gap: 8 },
    badge: { backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    badgeText: { color: '#f59e0b', fontSize: 10, fontWeight: 'bold' },

    // Buttons
    actionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    approveBtn: { backgroundColor: '#22c55e' },
    rejectBtn: { backgroundColor: '#ef4444' },

    compactBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
    compactBtnText: { fontSize: 11, fontWeight: '600' },

    promoteBtn: { borderColor: '#3b82f6' },
    promoteBtnText: { color: '#3b82f6' },

    demoteBtn: { borderColor: '#64748b' },
    demoteBtnText: { color: '#94a3b8' },

    kickBtn: { borderColor: '#ef4444' },
    kickBtnText: { color: '#ef4444' },
});
