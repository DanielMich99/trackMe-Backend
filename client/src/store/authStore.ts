import { create } from 'zustand';

interface Group {
    id: string;
    name: string;
    joinCode: string;
}

interface User {
    id: string;
    email: string;
    // groupId is deprecated in favor of groups list, but we keep it for backward compat if needed or remove it.
    // Let's remove it to match the backend refactor.
}

interface AuthState {
    token: string | null;
    user: User | null;
    groups: Group[];
    activeGroupId: string | null; // הקבוצה שכרגע מוצגת במפה
    setAuth: (token: string, user: User) => void;
    setGroups: (groups: Group[]) => void;
    setActiveGroup: (groupId: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: localStorage.getItem('token'),
    user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
    groups: [],
    activeGroupId: null,

    setAuth: (token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ token, user });
    },

    setGroups: (groups) => {
        set((state) => ({
            groups,
            // אם אין קבוצה פעילה ויש קבוצות, נבחר את הראשונה אוטומטית
            activeGroupId: state.activeGroupId || (groups.length > 0 ? groups[0].id : null)
        }));
    },

    setActiveGroup: (groupId) => {
        set({ activeGroupId: groupId });
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ token: null, user: null, groups: [], activeGroupId: null });
    },
}));