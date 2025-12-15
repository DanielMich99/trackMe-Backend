
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

export default function GroupSelector() {
    const { groups, activeGroupId, setActiveGroup, setGroups } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [joinCode, setJoinCode] = useState('');

    // טעינת הקבוצות בהתחלה
    useEffect(() => {
        api.get('/groups/my-groups').then((res) => {
            setGroups(res.data);
        }).catch(console.error);
    }, [setGroups]);

    const handleJoin = async () => {
        try {
            const res = await api.post('/groups/join', { joinCode });
            alert(`Joined ${res.data.group.name}!`);
            setGroups([...groups, res.data.group]);
            setJoinCode('');
        } catch (err: any) {
            alert('Failed to join: ' + err.response?.data?.message);
        }
    };

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
            {/* כפתור ראשי להצגת הקבוצה הנוכחית */}
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

            {/* תפריט נפתח */}
            {isOpen && (
                <div className="bg-white rounded-lg shadow-xl p-2 w-[250px] flex flex-col gap-2">
                    <p className="text-xs text-gray-400 uppercase font-bold px-2">Switch Group</p>
                    {groups.map(g => (
                        <div
                            key={g.id}
                            className={`p-2 rounded cursor-pointer hover:bg-gray-100 ${activeGroupId === g.id ? 'bg-blue-50 text-blue-600' : ''}`}
                            onClick={() => {
                                setActiveGroup(g.id);
                                setIsOpen(false);
                            }}
                        >
                            {g.name}
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
