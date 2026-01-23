import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';


export { BACKGROUND_LOCATION_TASK };

let lastLocationTime = 0;
let noUserCount = 0; // Track consecutive failures to find user/group
const MAX_NO_USER_ATTEMPTS = 3; // Stop task after this many failures

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
    try {
        if (error) {
            console.error("[Background Task] ❌ Error:", error);
            return;
        }

        if (data) {
            const { locations } = data;
            const location = locations[0]; // Get the newest location

            if (location) {
                console.log('[Background Task] 📍 Location received:', location.coords.latitude, location.coords.longitude);

                const now = Date.now();
                // Throttle: Max once per 5 seconds
                if (now - lastLocationTime >= 5000) {
                    console.log('[Background Task] ✅ Throttle passed');

                    try {
                        // Direct storage read to bypass hydration issues
                        const jsonState = await AsyncStorage.getItem('auth-storage');

                        if (jsonState) {
                            const parsed = JSON.parse(jsonState);
                            const state = parsed.state;

                            if (state && state.user && state.activeGroupId) {
                                noUserCount = 0; // Reset counter on success
                                lastLocationTime = now;
                                console.log(`[Background Task] 🚀 Sending for user ${state.user.id}: ${location.coords.latitude}, ${location.coords.longitude}`);

                                await api.post('/location', {
                                    latitude: location.coords.latitude,
                                    longitude: location.coords.longitude,
                                });
                                console.log('[Background Task] ✅ Sent location successfully');
                            } else {
                                noUserCount++;
                                console.warn(`[Background Task] ⚠️ User/Group not found in storage (attempt ${noUserCount}/${MAX_NO_USER_ATTEMPTS})`);
                                if (noUserCount >= MAX_NO_USER_ATTEMPTS) {
                                    console.log('[Background Task] 🛑 Stopping task - no user logged in');
                                    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                                }
                            }
                        } else {
                            noUserCount++;
                            console.warn(`[Background Task] ⚠️ Storage is empty (attempt ${noUserCount}/${MAX_NO_USER_ATTEMPTS})`);
                            if (noUserCount >= MAX_NO_USER_ATTEMPTS) {
                                console.log('[Background Task] 🛑 Stopping task - no auth storage found');
                                await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
                            }
                        }
                    } catch (err: any) {
                        console.error('[Background Task] ❌ Failed:', err.message);
                    }
                }
            }
        }
    } catch (criticalError: any) {
        console.error('[Background Task] 💥 CRITICAL CRASH:', criticalError.message);
    }
});
