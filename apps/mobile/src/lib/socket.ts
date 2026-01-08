import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

const SOCKET_URL = API_URL;

class SocketManager {
    private socket: Socket | null = null;

    connect(userId: string) {
        if (this.socket) return;

        this.socket = io(SOCKET_URL, {
            query: { userId },
            transports: ['websocket'],
            autoConnect: true,
        });

        this.socket.on('connect', () => {
            console.log('socket connected:', this.socket?.id);
        });

        this.socket.on('disconnect', () => {
            console.log('socket disconnected');
        });

        this.socket.on('connect_error', (err) => {
            console.error('socket connection error', err);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    getSocket() {
        return this.socket;
    }
}

export const socketManager = new SocketManager();
