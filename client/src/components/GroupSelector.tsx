/**
 * GroupSelector Component
 * 
 * Dropdown menu for managing groups - allows users to:
 * 1. View currently active group
 * 2. Switch between their groups
 * 3. Create new groups
 * 4. Join existing groups using a code
 * 
 * Appears in the top-left corner of the map page.
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

export default function GroupSelector() {
    const { groups, activeGroupId, setActiveGroup, setGroups } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [joinCode, setJoinCode] = useState('');

    // Load user's groups on component mount
    useEffect(() => {
        api.get('/groups/my-groups').then((res) => {
            setGroups(res.data);
        }).catch(console.error);
    }, [setGroups]);

    /**
     * Handles joining a group using a join code
     * Adds the joined group to the user's groups list (as pending)
     */
    const handleJoin = async () => {
        try {
            const res = await api.post('/groups/join', { joinCode });
            // Refresh groups list to show the new pending group
            const groupsRes = await api.get('/groups/my-groups');
            setGroups(groupsRes.data);
            alert(res.data.message || `Request sent to ${res.data.group.name}!`);
            setJoinCode('');
        } catch (err: any) {
            alert('Failed to join: ' + err.response?.data?.message);
        }
    };

    /**
     * Handles creating a new group
     * Prompts user for group name and sets it as active group
     */
    const handleCreate = async () => {
        const name = prompt('Enter group name:');
        if (!name) return;

        try {
            const res = await api.post('/groups/create', { name });
            setGroups([...groups, res.data]);
            setActiveGroup(res.data.id);
        } catch (err) {
            console.error(err);
        }
    }

    const activeGroup = groups.find(g => g.id === activeGroupId);

    return (
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
            {/* Main button showing the currently active group */}
            <div
                className="bg-white p-3 rounded-lg shadow-lg cursor-pointer flex items-center gap-2 min-w-[200px]"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="bg-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold">
                    {activeGroup ? activeGroup.name[0].toUpperCase() : '?'}
                </div>
                <div className="flex-1">
                    <p className="font-bold text-gray-800 text-sm">
                        {activeGroup ? activeGroup.name : 'No Group Selected'}
                    </p>
                    {activeGroup && <p className="text-xs text-gray-500">Code: {activeGroup.joinCode}</p>}
                </div>
                <span>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* Dropdown menu - shown when isOpen is true */}
            {isOpen && (
                <div className="bg-white rounded-lg shadow-xl p-2 w-[250px] flex flex-col gap-2">
                    <p className="text-xs text-gray-400 uppercase font-bold px-2">Switch Group</p>
                    {groups.map((g: any) => (
                        <div
                            key={g.id}
                            className={`p-2 rounded cursor-pointer hover:bg-gray-100 flex items-center justify-between ${activeGroupId === g.id ? 'bg-blue-50 text-blue-600' : ''}`}
                            onClick={() => {
                                setActiveGroup(g.id);
                                setIsOpen(false);
                            }}
                        >
                            <span>{g.name}</span>
                            {g.myStatus === 'PENDING' && (
                                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">
                                    Pending
                                </span>
                            )}
                        </div>
                    ))}

                    <hr className="my-1" />

                    <button onClick={handleCreate} className="text-left p-2 hover:bg-gray-100 text-sm font-bold text-blue-600">
                        + Create New Group
                    </button>

                    <div className="flex gap-1 p-1">
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            placeholder="Enter Code"
                            className="bg-gray-100 text-sm p-1 rounded w-full border"
                        />
                        <button onClick={handleJoin} className="bg-green-500 text-white text-xs px-2 rounded">
                            Join
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
