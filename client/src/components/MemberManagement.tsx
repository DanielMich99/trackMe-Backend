
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface Member {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'MEMBER';
    status: 'PENDING' | 'APPROVED';
}

interface Props {
    groupId: string;
}

export default function MemberManagement({ groupId }: Props) {
    const { user } = useAuthStore();
    const [members, setMembers] = useState<Member[]>([]);
    const [pending, setPending] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // State for local admin check
    const [isAdmin, setIsAdmin] = useState(false);

    const fetchMembers = async () => {
        if (!user || !groupId) {
            console.log('[MemberMgmt] Skipping fetch - missing user or groupId');
            return;
        }

        console.log('[MemberMgmt] === Starting fetchMembers ===');
        console.log('[MemberMgmt] User ID:', user.id);
        console.log('[MemberMgmt] Group ID:', groupId);

        setLoading(true);
        try {
            // 1. Get My Groups to find current group and MY role
            const res = await api.get('/groups/my-groups');
            console.log('[MemberMgmt] Received groups response:', res.data);

            const group = res.data.find((g: any) => g.id === groupId);
            console.log('[MemberMgmt] Found current group:', group);

            if (group && group.users) {
                setMembers(group.users);
                console.log('[MemberMgmt] Members set:', group.users);

                // 2. Check Admin Role for THIS group
                const myUser = group.users.find((u: any) => u.id === user.id);
                console.log('[MemberMgmt] My user record:', myUser);

                const amIAdmin = myUser?.role === 'ADMIN';
                setIsAdmin(amIAdmin);

                console.log('[MemberMgmt] Group Loaded:', group.name, '| My Role:', myUser?.role, '| Admin?', amIAdmin);

                // 3. Fetch Pending Requests if Admin
                if (amIAdmin) {
                    console.log('[MemberMgmt] I am admin, fetching pending requests...');
                    try {
                        const pendingRes = await api.get(`/groups/pending?groupId=${groupId}`);
                        console.log('[MemberMgmt] ✅ Pending Requests Response:', pendingRes.data);
                        setPending(pendingRes.data);
                    } catch (e) {
                        console.error('[MemberMgmt] ❌ Failed to fetch pending:', e);
                        setPending([]);
                    }
                } else {
                    console.log('[MemberMgmt] Not admin, skipping pending requests');
                    setPending([]);
                }
            }
        } catch (err) {
            console.error('[MemberMgmt] Error fetching members:', err);
        } finally {
            setLoading(false);
            console.log('[MemberMgmt] === Fetch complete ===');
        }
    };

    useEffect(() => {
        fetchMembers();
    }, [groupId, user?.id]); // Depend on user.id specifically

    const handleAction = async (action: 'approve' | 'kick' | 'promote' | 'demote', targetUserId: string) => {
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;
        try {
            await api.post(`/groups/${action}`, { groupId, userId: targetUserId });
            fetchMembers(); // Refresh list
        } catch (err) {
            alert('Action failed');
        }
    };

    // Moved to relative flow in parent stack
    return (
        <div className="bg-white p-4 rounded-lg shadow-xl w-[300px] max-h-[60vh] overflow-y-auto border border-gray-200">
            <h3 className="font-bold text-lg mb-2 border-b">Member List</h3>

            {loading && <p className="text-sm text-gray-500">Loading...</p>}

            {isAdmin && pending.length > 0 && (
                <div className="mb-4 bg-yellow-50 p-2 rounded">
                    <h4 className="font-bold text-xs text-yellow-800 uppercase mb-2">Pending Requests</h4>
                    {pending.map((req: any) => (
                        <div key={req.id} className="flex justify-between items-center mb-2">
                            <span className="text-sm">{req.user.email}</span>
                            <button
                                onClick={() => handleAction('approve', req.user.id)}
                                className="bg-green-500 text-white text-xs px-2 py-1 rounded"
                            >
                                Approve (as Member)
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-2">
                {members.map(member => (
                    <div key={member.id} className="flex justify-between items-start border-b pb-2 last:border-0">
                        <div>
                            <p className="font-bold text-sm flex items-center gap-1">
                                {member.name}
                                {member.role === 'ADMIN' && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">ADMIN</span>}
                            </p>
                            <p className="text-xs text-gray-500">{member.email}</p>
                        </div>

                        {isAdmin && member.id !== user?.id && (
                            <div className="flex flex-col gap-1">
                                {member.role === 'MEMBER' && (
                                    <button onClick={() => handleAction('promote', member.id)} className="text-[10px] text-blue-500 hover:underline">Promote</button>
                                )}
                                {member.role === 'ADMIN' && (
                                    <button onClick={() => handleAction('demote', member.id)} className="text-[10px] text-orange-500 hover:underline">Demote</button>
                                )}
                                <button onClick={() => handleAction('kick', member.id)} className="text-[10px] text-red-500 hover:underline">Kick</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Debug Info */}
            <div className="mt-4 pt-4 border-t text-[10px] text-gray-400">
                <p className="font-bold text-gray-500">Debug Info:</p>
                <p>Am I Admin? {isAdmin ? 'YES' : 'NO'}</p>
                <p>Pending Requests: {pending.length}</p>
                <p>My ID (Store): {user?.id?.slice(0, 8)}...</p>
                <p>Members found: {members.length}</p>
                <div className="max-h-20 overflow-auto border mt-1 p-1">
                    {members.map(m => (
                        <div key={m.id} className={m.id === user?.id ? "text-blue-500 font-bold" : ""}>
                            {m.name} ({m.role}) - {m.id.slice(0, 8)}...
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
