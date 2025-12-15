
import { useEffect } from 'react';

interface ToastProps {
    message: string;
    type: 'danger' | 'info';
    onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColors = {
        danger: 'bg-red-500',
        info: 'bg-blue-500'
    };

    return (
        <div className={`fixed top-4 right-4 z-[2000] ${bgColors[type]} text-white px-6 py-4 rounded-lg shadow-xl animate-bounce flex items-center gap-3`}>
            {type === 'danger' && <span className="text-2xl">🚨</span>}
            <div>
                <p className="font-bold uppercase tracking-wider">{type}</p>
                <p className="text-sm">{message}</p>
            </div>
        </div>
    );
}
