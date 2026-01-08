import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { User, Group } from '../types';

interface AuthState {
    user: User | null;
    token: string | null;
    groups: Group[];
    activeGroupId: string | null;
    isLoading: boolean;
    error: string | null;
    isHydrated: boolean;

    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    fetchGroups: () => Promise<void>;
    setActiveGroup: (groupId: string) => void;
    clearError: () => void;
    setHydrated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            groups: [],
            activeGroupId: null,
            isLoading: false,
            error: null,
            isHydrated: false,

            login: async (email, password) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await api.post('/auth/login', { email, password });
                    const { accessToken, user } = res.data;
                    set({ token: accessToken, user, isLoading: false });
                    // persist a simple token key so api interceptor can read it immediately
                    try {
                        await AsyncStorage.setItem('token', accessToken);
                    } catch (e) {
                        console.log('[authStore] failed to persist token to AsyncStorage', e);
                    }
                    await get().fetchGroups();
                } catch (err: any) {
                    const msg = err.response?.data?.message || 'Login failed';
                    set({ error: msg, isLoading: false });
                    throw err;
                }
            },

            register: async (name, email, password) => {
                set({ isLoading: true, error: null });
                try {
                    const res = await api.post('/auth/register', { name, email, password });
                    const { accessToken, user } = res.data;
                    set({ token: accessToken, user, isLoading: false });
                    // persist a simple token key so api interceptor can read it immediately
                    try {
                        await AsyncStorage.setItem('token', accessToken);
                    } catch (e) {
                        console.log('[authStore] failed to persist token to AsyncStorage', e);
                    }
                    await get().fetchGroups();
                } catch (err: any) {
                    const msg = err.response?.data?.message || 'Registration failed';
                    set({ error: msg, isLoading: false });
                    throw err;
                }
            },

            logout: () => {
                set({
                    user: null,
                    token: null,
                    groups: [],
                    activeGroupId: null,
                    error: null
                });
                // remove simple token key
                AsyncStorage.removeItem('token').catch((e) => console.log('[authStore] failed to remove token', e));
            },

            fetchGroups: async () => {
                try {
                    const res = await api.get('/groups/my-groups');
                    const approvedGroups = res.data.filter((g: Group) => g.myStatus === 'APPROVED');
                    set((state) => {
                        let newActiveGroupId = state.activeGroupId;
                        if (approvedGroups.length > 0) {
                            const stillExists = approvedGroups.find((g: Group) => g.id === newActiveGroupId);
                            if (!newActiveGroupId || !stillExists) {
                                newActiveGroupId = approvedGroups[0].id;
                            }
                        } else {
                            newActiveGroupId = null;
                        }
                        return { groups: approvedGroups, activeGroupId: newActiveGroupId };
                    });
                } catch (err) {
                    console.error('Failed to fetch groups:', err);
                }
            },

            setActiveGroup: (groupId) => {
                set({ activeGroupId: groupId });
            },

            clearError: () => set({ error: null }),

            setHydrated: (val: boolean) => set({ isHydrated: val }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                token: state.token,
                user: state.user,
                activeGroupId: state.activeGroupId
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHydrated(true);
            },
        }
    )
);
