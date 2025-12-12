import { useEffect, useState } from 'react';
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

export default function MapPage() {
    const user = useAuthStore((state) => state.user);
    const [socket, setSocket] = useState<Socket | null>(null);

    // כאן נשמור את המיקומים של כולם: מפתח = userId, ערך = המיקום
    const [familyLocations, setFamilyLocations] = useState<Record<string, LocationData>>({});

    // המיקום שלי (כדי למרכז את המפה)
    const [myPosition, setMyPosition] = useState<[number, number] | null>(null);

    // 1. חיבור ל-Socket והאזנה לעדכונים
    useEffect(() => {
        if (!user) return;

        // מתחברים ל-Gateway
        const newSocket = io('http://localhost:3000', {
            query: { userId: user.id }, // שולחים את ה-ID כדי שהשרת ידע מי אנחנו
        });

        // מאזינים לאירוע שהגדרנו ב-Gateway
        newSocket.on('newLocationReceived', (data: LocationData) => {
            console.log('🔔 Update received:', data);

            // עדכון ה-State (שמירה על המיקומים הקיימים + החדש)
            setFamilyLocations((prev) => ({
                ...prev,
                [data.userId]: data // דורס את המיקום הישן של אותו יוזר
            }));
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [user]);

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
            {/* כפתור יציאה צף */}
            <div className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded shadow">
                <p className="text-sm font-bold text-gray-700">User: {user?.email}</p>
            </div>

            <MapContainer center={myPosition} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* הצגת המיקומים של כל המשפחה */}
                {Object.values(familyLocations).map((loc) => (
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