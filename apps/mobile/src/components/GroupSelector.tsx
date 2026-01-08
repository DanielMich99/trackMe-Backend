import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Octicons } from '@expo/vector-icons';

interface GroupSelectorProps {
    activeGroup: any;
    groups: any[];
    onSelectGroup: (groupId: string) => void;
    onCreateGroup?: (name: string) => Promise<void>;
    onJoinGroup?: (code: string) => Promise<void>;
    children?: React.ReactNode;
}

export const GroupSelector = ({
    activeGroup,
    groups,
    onSelectGroup,
    onCreateGroup,
    onJoinGroup,
    children
}: GroupSelectorProps) => {
    const [expanded, setExpanded] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [joinCode, setJoinCode] = useState('');

    const isAdmin = activeGroup?.myRole === 'ADMIN';

    const handleCreate = async () => {
        if (onCreateGroup && newGroupName.trim()) {
            await onCreateGroup(newGroupName);
            setShowCreate(false);
            setNewGroupName('');
        }
    };

    const handleJoin = async () => {
        if (onJoinGroup && joinCode.trim()) {
            await onJoinGroup(joinCode);
            setShowJoin(false);
            setJoinCode('');
        }
    };

    return (
        <View style={styles.container}>
            {!expanded ? (
                <View style={styles.expandableCard}>
                    <TouchableOpacity
                        style={styles.cardHeader}
                        onPress={() => setExpanded(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.cardHeaderLeft}>
                            <View style={styles.cardIconContainer}>
                                <Octicons name="people" size={16} color="#3b82f6" />
                            </View>
                            <View>
                                <View style={styles.groupNameRow}>
                                    <Text style={styles.groupName}>
                                        {activeGroup?.name || 'No Group'}
                                    </Text>
                                    <Octicons name="chevron-down" size={16} color="#94a3b8" />
                                </View>
                                <Text style={styles.memberCount}>
                                    {activeGroup?.users?.length || 0} members • {isAdmin ? 'Admin' : 'Member'}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    {children && (
                        <>
                            <View style={styles.divider} />
                            {children}
                        </>
                    )}
                </View>
            ) : (
                <View style={styles.expandedCard}>
                    <View style={styles.expandedHeader}>
                        <Text style={styles.expandedTitle}>Select Group</Text>
                        <TouchableOpacity onPress={() => setExpanded(false)}>
                            <Octicons name="x" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ maxHeight: 300, marginBottom: 16 }}>
                        <Text style={styles.sectionTitle}>Your Groups</Text>
                        {groups.map(g => (
                            <TouchableOpacity
                                key={g.id}
                                style={[
                                    styles.groupItem,
                                    g.id === activeGroup?.id && styles.activeGroup
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
                    </ScrollView>

                    {(onCreateGroup || onJoinGroup) && (
                        <View style={styles.actionButtons}>
                            {onCreateGroup && (
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.createBtn]}
                                    onPress={() => {
                                        setExpanded(false);
                                        setShowCreate(true);
                                    }}
                                >
                                    <Text style={styles.actionBtnText}>Create Group</Text>
                                </TouchableOpacity>
                            )}
                            {onJoinGroup && (
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.joinBtn]}
                                    onPress={() => {
                                        setExpanded(false);
                                        setShowJoin(true);
                                    }}
                                >
                                    <Text style={styles.actionBtnText}>Join Group</Text>
                                </TouchableOpacity>
                            )}
                        </View>
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
                            placeholder="Enter 6-digit code"
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
    container: { flex: 1 },
    expandableCard: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cardIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    groupNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    groupName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    memberCount: {
        color: '#94a3b8',
        fontSize: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#334155',
        marginHorizontal: 12,
    },
    expandedCard: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 16,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    expandedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    expandedTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    sectionTitle: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
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
    activeGroup: {
        borderColor: '#3b82f6',
        borderWidth: 2,
    },
    groupItemText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    createBtn: {
        backgroundColor: '#22c55e',
    },
    joinBtn: {
        backgroundColor: '#3b82f6',
    },
    actionBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    // Modal Styles
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
        backgroundColor: '#1e293b',
        borderRadius: 8,
        borderColor: '#3b82f6',
        borderWidth: 1,
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
