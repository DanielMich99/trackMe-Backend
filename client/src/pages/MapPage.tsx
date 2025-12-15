import { useEffect, useState, useMemo } from 'react';
import GroupSelector from '../components/GroupSelector';
import SosButton from '../components/SosButton';
import Toast from '../components/Toast';
import MemberManagement from '../components/MemberManagement';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { io, Socket } from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- תיקון לאייקונים של Leaflet ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;
// ----------------------------------

interface LocationData {
    userId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
}

interface SosAlert {
    userId: string;
    userName: string;
    message: string;
}

interface ToastData {
    id: number;
    message: string;
    type: 'danger' | 'info';
}

export default function MapPage() {
    const user = useAuthStore((state) => state.user);
    const [socket, setSocket] = useState<Socket | null>(null);

    // כאן נשמור את המיקומים של כולם: מפתח = userId, ערך = המיקום
    const [familyLocations, setFamilyLocations] = useState<Record<string, LocationData>>({});

    // המיקום שלי (כדי למרכז את המפה)
    const [myPosition, setMyPosition] = useState<[number, number] | null>(null);

    const activeGroupId = useAuthStore((state) => state.activeGroupId);
    const [groupMembers, setGroupMembers] = useState<string[]>([]); // User IDs
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const [showMembers, setShowMembers] = useState(false);

    // 1. טעינת חברי הקבוצה הפעילה (לסינון מפה)
    useEffect(() => {
        if (!activeGroupId) return;

        api.get(`/groups/my-groups`) // אופטימיזציה: כדאי אנדפוינט שמביא חברים לקבוצה ספציפית
            .then(res => {
                const groups = res.data;
                const active = groups.find((g: any) => g.id === activeGroupId);
                if (active && active.users) {
                    setGroupMembers(active.users.map((u: any) => u.id));
                }
            })
            .catch(console.error);
    }, [activeGroupId]);

    // 2. חיבור סוקט והאזנה
    useEffect(() => {
        if (!user) return;

        const newSocket = io('http://localhost:3000', {
            query: { userId: user.id },
        });

        // עדכון מיקום
        newSocket.on('newLocationReceived', (data: LocationData) => {
            setFamilyLocations((prev) => ({
                ...prev,
                [data.userId]: data
            }));
        });

        // האזנה ל-SOS
        newSocket.on('SOS_ALERT', (data: SosAlert) => {
            addToast(`${data.userName}: ${data.message}`, 'danger');
        });

        // האזנה להתראות אזורים
        newSocket.on('alerts', (data: any) => {
            // התראה שמגיעה מקפקא (דרך Gateway)
            addToast(`${data.user} entered DANGER ZONE: ${data.area}`, 'danger');
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [user]);

    const addToast = (msg: string, type: 'danger' | 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message: msg, type }]);
        // הסרה אוטומטית מנוהלת בתוך הקומפוננטה Toast עצמה, 
        // אבל ברמת המערך כאן ננקה ידנית או נסמוך על המשתמש שיסגור.
        // לשם הפשטות, נעיף אותו מהמערך אחרי 5 שניות
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

    // סינון המיקומים לפי הקבוצה הפעילה (אם יש כזו)
    // אם אין קבוצה פעילה, מציגים את כולם (או כלום, תלוי בהחלטה. נציג כולם)
    const visibleLocations = useMemo(() => {
        if (!activeGroupId) return Object.values(familyLocations);

        // מציג רק אם המשתמש נמצא ברשימת החברים של הקבוצה הפעילה
        // (וגם את עצמי תמיד)
        // הערה: groupMembers כרגע ריק כי ה-API getMyGroups לא בטוח מחזיר users.
        // נניח לבינתיים שלא מסננים, או שנתקן את ה-API.
        // לצורך הדמו הראשוני: מציגים הכל.
        return Object.values(familyLocations);
    }, [familyLocations, activeGroupId, groupMembers]);

    // 2. שליחת המיקום שלי לשרת (GPS)
    useEffect(() => {
        if (!navigator.geolocation) return;

        // פונקציה ששולחת את המיקום ל-API
        const sendLocation = async (lat: number, long: number) => {
            try {
                await api.post('/location', {
                    latitude: lat,
                    longitude: long
                });
                console.log('📤 Sent my location');
            } catch (err) {
                console.error('Error sending location', err);
            }
        };

        // מתחילים לעקוב אחרי המיקום בדפדפן
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setMyPosition([latitude, longitude]);

                // שולחים לשרת! (השרת יעביר לקפקא -> פרוססור -> רדיס -> סוקט -> חזרה לפה)
                sendLocation(latitude, longitude);
            },
            (error) => console.error('GPS Error:', error),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    if (!myPosition) {
        return <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
            Loading GPS... (Please allow location access)
        </div>;
    }

    return (
        <div className="h-screen w-screen relative">
            <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
                <GroupSelector />
            </div>

            {/* Top Right: User Info & Controls Stack */}
            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 items-end max-h-[90vh] pointer-events-none">
                {/* User Info */}
                <div className="bg-white p-2 rounded shadow pointer-events-auto flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-700">User: {user?.email}</p>
                    <button
                        onClick={() => useAuthStore.getState().logout()}
                        className="text-xs text-red-500 hover:text-red-700 font-bold border-l pl-2 ml-2"
                    >
                        Logout
                    </button>
                </div>

                {/* Members Toggle */}
                {activeGroupId && (
                    <button
                        onClick={() => setShowMembers(!showMembers)}
                        className="bg-white p-2 rounded shadow text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-50 pointer-events-auto"
                    >
                        👥 Members {showMembers ? '▼' : '▶'}
                    </button>
                )}

                {/* Member List Panel - Flows naturally in stack */}
                {activeGroupId && showMembers && (
                    <div className="pointer-events-auto">
                        <MemberManagement groupId={activeGroupId} />
                    </div>
                )}
            </div>

            <MapContainer center={myPosition} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* הצגת המיקומים של כל המשפחה */}
                {visibleLocations.map((loc) => (
                    <Marker key={loc.userId} position={[loc.latitude, loc.longitude]}>
                        <Popup>
                            User ID: {loc.userId.slice(0, 5)}...<br />
                            Last Seen: {new Date(loc.timestamp).toLocaleTimeString()}
                        </Popup>
                    </Marker>
                ))}

                {/* הצגת המיקום שלי בצבע אחר (אופציונלי, כרגע זה אותו אייקון) */}
                <Marker position={myPosition}>
                    <Popup>Me</Popup>
                </Marker>

            </MapContainer>
        </div>
    );
}