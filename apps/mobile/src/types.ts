export interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
}

export interface GroupMember {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'MEMBER';
    latitude?: number;
    longitude?: number;
    lastSeen?: string;
    avatar?: string;
}

export interface Group {
    id: string;
    name: string;
    joinCode: string;
    myStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
    myRole: 'ADMIN' | 'MEMBER';
    users?: GroupMember[];
}

export interface LocationPoint {
    id: number;
    userId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
}
