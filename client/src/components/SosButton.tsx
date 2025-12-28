/**
 * SosButton Component
 * 
 * Emergency SOS button that sends alerts to all group members.
 * 
 * Features:
 * - Confirmation dialog before sending
 * - Visual feedback (pulsing animation)
 * - Sends alert via WebSocket to all connected users
 * - Centered at bottom of screen for easy access
 */

import { useState } from 'react';
import { api } from '../lib/api';

export default function SosButton() {
    const [sending, setSending] = useState(false);

    /**
     * Handles sending SOS alert
     * Shows confirmation, sends alert to backend,
     * and provides visual feedback for 3 seconds
     */
    const handleSos = async () => {
        if (!confirm('Are you sure you want to send an SOS alert to your family?')) return;

        setSending(true);
        try {
            await api.post('/sos');
        } catch (err) {
            alert('Failed to send SOS');
        }

        // Keep button in "pressed" state briefly for visual feedback
        setTimeout(() => setSending(false), 3000);
    };

    return (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-[1000]">
            <button
                onClick={handleSos}
                className={`
                    w-20 h-20 rounded-full shadow-2xl border-4 border-white
                    flex items-center justify-center
                    transition-all duration-300 transform hover:scale-110 active:scale-90
                    ${sending ? 'bg-red-800 animate-pulse' : 'bg-red-600'}
                `}
            >
                <div className="text-white font-bold text-2xl">
                    {sending ? '!!!' : 'SOS'}
                </div>
            </button>

            {/* Ripple effect animation while sending */}
            {sending && (
                <>
                    <div className="absolute inset-0 rounded-full bg-red-500 opacity-50 animate-ping"></div>
                    <div className="absolute -inset-4 rounded-full bg-red-500 opacity-30 animate-pulse"></div>
                </>
            )}
        </div>
    );
}
