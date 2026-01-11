import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { Octicons, FontAwesome5 } from '@expo/vector-icons';

interface Member {
    userId: string;
    userName: string;
    role?: string;
    latitude: number;
    longitude: number;
}

interface FloatingMemberCardProps {
    activeGroup: any;
    members: Member[];
    groups: any[];
    currentUserId?: string;
    onFocusMember: (member: Member) => void;
    onSelectGroup: (groupId: string) => void;
    onCreateGroup?: (name: string) => Promise<void>;
    onJoinGroup?: (code: string) => Promise<void>;
}

export const FloatingMemberCard = ({
    activeGroup,
    members,
    groups,
    currentUserId,
    onFocusMember,
    onSelectGroup,
    onCreateGroup,
    onJoinGroup
}: FloatingMemberCardProps) => {
    const [expanded, setExpanded] = useState(false);
    const [viewMode, setViewMode] = useState<'members' | 'groups'>('members');
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [joinCode, setJoinCode] = useState('');

    const toggleExpand = () => {
        setExpanded(!expanded);
        if (expanded) {
            setViewMode('members'); // Reset to members view on collapse
        }
    };

    const handleCreate = async () => {
        if (onCreateGroup && newGroupName.trim()) {
            await onCreateGroup(newGroupName);
            setShowCreate(false);
            setNewGroupName('');
            setExpanded(false);
        }
    };

    const handleJoin = async () => {
        if (onJoinGroup && joinCode.trim()) {
            await onJoinGroup(joinCode);
            setShowJoin(false);
            setJoinCode('');
            setExpanded(false);
        }
    };

    return (
        <View style={styles.cardWrapper}>
            <TouchableOpacity
                style={[styles.mainCard, expanded && styles.cardExpanded]}
                onPress={toggleExpand}
                activeOpacity={0.9}
            >
                <View style={styles.cardContent}>
                    <View style={styles.iconContainer}>
                        <Text style={styles.iconText}>⊕</Text>
                    </View>
                    <View style={styles.infoContainer}>
                        <Text style={styles.label}>Active Group</Text>
                        <View style={styles.nameRow}>
                            <Text style={styles.groupName}>
                                {activeGroup?.name || 'Tap to select'}
                            </Text>
                            {activeGroup && (
                                <Text style={styles.joinCode}>
                                    Code: {activeGroup.joinCode}
                                </Text>
                            )}
                        </View>
                    </View>
                    <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
                        <Octicons name="chevron-down" size={24} color="#94a3b8" />
                    </View>
                </View>
            </TouchableOpacity>

            {expanded && (
                <View style={styles.expandedContent}>
                    {viewMode === 'members' ? (
                        <ScrollView style={{ maxHeight: 300 }}>
                            {members.length > 0 ? members.map(member => (
                                <TouchableOpacity
                                    key={member.userId}
                                    style={styles.memberItem}
                                    onPress={() => {
                                        onFocusMember(member);
                                        setExpanded(false);
                                    }}
                                >
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>
                                            {member.userName.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={styles.memberName}>
                                            {member.userName} {member.userId === currentUserId ? '(You)' : ''}
                                        </Text>
                                        {member.role === 'ADMIN' && (
                                            <Text style={styles.roleText}>Admin</Text>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            )) : (
                                <Text style={styles.emptyText}>No members online</Text>
                            )}

                            <TouchableOpacity
                                style={styles.switchBtn}
                                onPress={() => setViewMode('groups')}
                            >
                                <Text style={styles.switchBtnText}>Switch Group</Text>
                                <FontAwesome5 name="exchange-alt" size={14} color="#94a3b8" />
                            </TouchableOpacity>
                        </ScrollView>
                    ) : (
                        <ScrollView style={{ maxHeight: 300 }}>
                            <Text style={styles.sectionTitle}>Your Groups</Text>
                            {groups.map(g => (
                                <TouchableOpacity
                                    key={g.id}
                                    style={[
                                        styles.groupItem,
                                        g.id === activeGroup?.id && styles.activeGroupItem
                                    ]}
                                    onPress={() => {
                                        onSelectGroup(g.id);
                                        setExpanded(false);
                                    }}
                                >
                                    <Text style={styles.groupItemText}>{g.name}</Text>
                                    {g.id === activeGroup?.id && <Octicons name="check" size={16} color="#3b82f6" />}
                                </TouchableOpacity>
                            ))}

                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.createBtn]}
                                    onPress={() => setShowCreate(true)}
                                >
                                    <Text style={styles.actionBtnText}>+ Create</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.joinBtn]}
                                    onPress={() => setShowJoin(true)}
                                >
                                    <Text style={styles.actionBtnText}>Join</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.switchBtn}
                                onPress={() => setViewMode('members')}
                            >
                                <Octicons name="chevron-left" size={16} color="#94a3b8" />
                                <Text style={[styles.switchBtnText, { marginRight: 0, marginLeft: 8 }]}>Back to Members</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>
            )}

            {/* Create Modal */}
            <Modal visible={showCreate} transparent animationType="fade">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create New Group</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Group Name"
                            placeholderTextColor="#666"
                            value={newGroupName}
                            onChangeText={setNewGroupName}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.modalCancel}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreate} style={styles.modalConfirm}>
                                <Text style={styles.modalConfirmText}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Join Modal */}
            <Modal visible={showJoin} transparent animationType="fade">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Join Group</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter Code"
                            placeholderTextColor="#666"
                            value={joinCode}
                            onChangeText={setJoinCode}
                            maxLength={6}
                            autoCapitalize="characters"
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity onPress={() => setShowJoin(false)} style={styles.modalCancel}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleJoin} style={[styles.modalConfirm, { backgroundColor: '#3b82f6' }]}>
                                <Text style={styles.modalConfirmText}>Join</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    cardWrapper: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 115 : 95,
        left: 16,
        right: 16,
        zIndex: 100,
    },
    mainCard: {
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    cardExpanded: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottomWidth: 0,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconText: { fontSize: 20, color: '#94a3b8' },
    infoContainer: { flex: 1, marginLeft: 12 },
    label: {
        fontSize: 11,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    nameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    groupName: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
        marginTop: 2,
    },
    joinCode: {
        color: '#94a3b8',
        fontSize: 12,
        marginRight: 4,
    },
    expandedContent: {
        backgroundColor: '#1e293b',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        marginBottom: 4,
        backgroundColor: 'rgba(51, 65, 85, 0.5)',
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    memberName: {
        color: '#fff',
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '500',
    },
    roleText: {
        color: '#94a3b8',
        fontSize: 10,
        marginLeft: 10,
    },
    emptyText: {
        color: '#94a3b8',
        textAlign: 'center',
        padding: 20,
    },
    switchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#334155',
    },
    switchBtnText: {
        color: '#94a3b8',
        fontSize: 12,
        marginRight: 8,
        fontWeight: '600',
    },
    sectionTitle: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 4,
        marginTop: 4,
        textTransform: 'uppercase',
    },
    groupItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: '#334155',
        borderRadius: 8,
        marginBottom: 8,
    },
    activeGroupItem: {
        borderColor: '#3b82f6',
        borderWidth: 2,
    },
    groupItemText: { color: '#fff', fontSize: 16 },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8,
    },
    actionBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    createBtn: { backgroundColor: '#22c55e' },
    joinBtn: { backgroundColor: '#3b82f6' },
    actionBtnText: { color: '#fff', fontWeight: 'bold' },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 24,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#334155',
        borderRadius: 8,
        padding: 14,
        color: '#fff',
        fontSize: 16,
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
    },
    modalCancel: {
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    modalCancelText: {
        color: '#94a3b8',
        fontSize: 16,
    },
    modalConfirm: {
        backgroundColor: '#22c55e',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    modalConfirmText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
