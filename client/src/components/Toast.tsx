/**
 * Toast Component
 * 
 * Temporary notification that appears in the top-right corner.
 * Used for alerts (SOS, geofence violations) and general notifications.
 * 
 * Features:
 * - Auto-dismisses after 5 seconds
 * - Different styles for 'danger' and 'info' types
 * - Bounce animation on appearance
 * - Appropriate icon for danger alerts (🚨)
 */

import { useEffect } from 'react';

/**
 * @property message - Text to display in the notification
 * @property type - 'danger' for critical alerts, 'info' for general notifications
 * @property onClose - Callback function to remove toast from parent component
 */
interface ToastProps {
    message: string;
    type: 'danger' | 'info';
    onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
    // Auto-dismiss after 5 seconds
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    // Background colors based on notification type
    const bgColors = {
        danger: 'bg-red-500',
        info: 'bg-blue-500'
    };

    return (
        <div className={`${bgColors[type]} text-white px-6 py-4 rounded-lg shadow-xl animate-bounce flex items-center gap-3 min-w-[300px]`}>
            {/* Show appropriate icon based on type */}
            {type === 'danger' && <span className="text-2xl">🚨</span>}
            {type === 'info' && <span className="text-2xl">ℹ️</span>}
            <div className="flex-1">
                {/* Notification type label */}
                <p className="font-bold uppercase tracking-wider text-xs">{type}</p>
                {/* Notification message */}
                <p className="text-sm">{message}</p>
            </div>
            {/* Close button */}
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl font-bold">×</button>
        </div>
    );
}
