import React, { useEffect } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useAuthStore } from '../store/authStore';
import { BACKGROUND_LOCATION_TASK } from '../tasks/backgroundLocationTask';

export const LocationTracker = () => {
    const activeGroupId = useAuthStore((state) => state.activeGroupId);
    const user = useAuthStore((state) => state.user);

    useEffect(() => {
        const startBackgroundTracking = async () => {
            console.log('[LocationTracker] Starting tracking...');
            // 1. Check permissions (Background is required for "Always")
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
            console.log('[LocationTracker] Foreground permission:', foregroundStatus);
            if (foregroundStatus !== 'granted') return;

            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
            console.log('[LocationTracker] Background permission:', backgroundStatus);
            if (backgroundStatus !== 'granted') {
                console.log('Background location permission denied');
            }

            // 2. Check if already running - skip if so (keeps tracking continuous)
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            if (hasStarted) {
                console.log('[LocationTracker] ✅ Task already running, skipping start');
                return;
            }

            // Verify task is defined
            const isDefined = await TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK);
            console.log('[LocationTracker] Is task defined?', isDefined);
            if (!isDefined) {
                console.error('[LocationTracker] ❌ Task is NOT defined! Check imports.');
                return;
            }

            // 3. Start the task
            try {
                await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,
                    distanceInterval: 10,
                    foregroundService: {
                        notificationTitle: "TrackMe Active",
                        notificationBody: "Sharing location with your group...",
                        notificationColor: "#3b82f6",
                    },
                    pausesUpdatesAutomatically: false,
                    activityType: Location.ActivityType.Fitness,
                    deferredUpdatesInterval: 5000,
                });
                console.log('[LocationTracker] ✅ Tracking started successfully');
            } catch (error: any) {
                // Ignore "background start" error (Android 12+ restriction)
                if (error?.message?.includes('Foreground service cannot be started')) {
                    // App is in background, will start when opened
                } else {
                    console.error('[LocationTracker] ❌ Failed to start tracking:', error.message);
                }
            }
        };

        const stopBackgroundTracking = async () => {
            console.log('[LocationTracker] Stopping tracking...');
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
            if (hasStarted) {
                await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                console.log('[LocationTracker] Tracking stopped');
            }
        };

        if (user && activeGroupId) {
            console.log('[LocationTracker] User and Group present, attempting to start...');
            startBackgroundTracking();
        } else {
            console.log('[LocationTracker] User or Group missing, stopping...');
            stopBackgroundTracking();
        }


        // Cleanup: Stop tracking when component unmounts (logout)
        return () => {
            stopBackgroundTracking();
        };
    }, [activeGroupId, user]);

    return null;
};
