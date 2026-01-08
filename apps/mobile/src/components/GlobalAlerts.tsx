import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { socketManager } from '../lib/socket';
import { Octicons } from '@expo/vector-icons';

interface AlertData {
    id: string; // unique ID for internal keying
    type: 'SOS_ALERT' | 'DANGER_ZONE_ENTER' | 'DANGER_ZONE_LEAVE' | 'SAFE_ZONE_ENTER' | 'SAFE_ZONE_LEAVE';
    title: string;
    message: string;
    timestamp: string;
    level: 'danger' | 'warning' | 'success';
}

const { width } = Dimensions.get('window');

export default function GlobalAlerts() {
    const [alert, setAlert] = useState<AlertData | null>(null);
    const slideAnim = useRef(new Animated.Value(-150)).current; // Start hidden above top

    useEffect(() => {
        const socket = socketManager.getSocket();
        if (!socket) return;

        const handleDangerZone = (data: any) => {
            console.log('Received Danger Alert:', data);
            const isEnter = data.type === 'DANGER_ZONE_ENTER';
            showAlert({
                id: Date.now().toString(),
                type: data.type,
                title: isEnter ? 'Danger Zone Entry' : 'Danger Zone Exit',
                message: `${data.userName} ${isEnter ? 'entered' : 'left'} ${data.areaName}`,
                timestamp: data.timestamp,
                level: isEnter ? 'danger' : 'warning',
            });
        };

        const handleSos = (data: any) => {
            console.log('Received SOS Alert:', data);
            showAlert({
                id: Date.now().toString(),
                type: 'SOS_ALERT',
                title: 'SOS ALERT',
                message: `SOS triggered by ${data.userName}!`,
                timestamp: data.timestamp,
                level: 'danger',
            });
        };

        const handleSafeZone = (data: any) => {
            console.log('Received Safe Alert:', data);
            const isEnter = data.type === 'SAFE_ZONE_ENTER';
            showAlert({
                id: Date.now().toString(),
                type: data.type,
                title: isEnter ? 'Safe Zone Entry' : 'Safe Zone Exit',
                message: `${data.userName} ${isEnter ? 'entered' : 'left'} ${data.areaName}`,
                timestamp: data.timestamp,
                level: isEnter ? 'success' : 'warning',
            });
        };

        socket.on('dangerZoneAlert', handleDangerZone);
        socket.on('safeZoneAlert', handleSafeZone);
        socket.on('SOS_ALERT', handleSos);

        return () => {
            socket.off('dangerZoneAlert', handleDangerZone);
            socket.off('safeZoneAlert', handleSafeZone);
            socket.off('SOS_ALERT', handleSos);
        };
    }, []);

    const showAlert = (newAlert: AlertData) => {
        setAlert(newAlert);
        // Slide down
        Animated.spring(slideAnim, {
            toValue: Platform.OS === 'ios' ? 60 : 40,
            useNativeDriver: true,
            friction: 5,
        }).start(() => {
            // Auto hide after 5 seconds
            setTimeout(hideAlert, 5000);
        });
    };

    const hideAlert = () => {
        Animated.timing(slideAnim, {
            toValue: -150,
            duration: 300,
            useNativeDriver: true,
        }).start(() => setAlert(null));
    };

    if (!alert) return null;

    const isDanger = alert.level === 'danger';

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY: slideAnim }] },
                alert.level === 'danger' ? styles.dangerBg :
                    alert.level === 'success' ? styles.successBg : styles.warningBg,
            ]}
        >
            <TouchableOpacity onPress={hideAlert} style={styles.content}>
                <View style={styles.iconContainer}>
                    <Octicons
                        name={
                            alert.type === 'SOS_ALERT' ? "alert" :
                                alert.type.includes('SAFE') ? "check-circle" : "shield"
                        }
                        size={24}
                        color="#FFF"
                    />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>{alert.title}</Text>
                    <Text style={styles.message}>{alert.message}</Text>
                </View>
                <Octicons name="x" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        zIndex: 9999, // On top of everything
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        overflow: 'hidden',
    },
    dangerBg: { backgroundColor: '#ef4444' }, // Red
    warningBg: { backgroundColor: '#f97316' }, // Orange
    successBg: { backgroundColor: '#22c55e' }, // Green
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    message: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
    },
});
