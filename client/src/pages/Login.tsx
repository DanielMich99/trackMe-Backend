import { useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const setAuth = useAuthStore((state) => state.setAuth);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            // 1. שליחת בקשה לשרת
            const res = await api.post('/auth/login', { email, password });

            // 2. שמירת הטוקן ב-Store (וב-localStorage)
            // השרת מחזיר { access_token, userId }, אבל אנחנו צריכים גם את המייל
            // בפרויקט אמיתי השרת היה מחזיר את כל היוזר, כאן נאלתר את המייל ידנית
            setAuth(res.data.access_token, { id: res.data.userId, email });

            // 3. מעבר למפה
            navigate('/map');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to login');
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
            <div className="w-full max-w-md p-8 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
                <h2 className="text-3xl font-bold text-center text-blue-500 mb-6">Welcome Back</h2>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Email</label>
                        <input
                            type="email"
                            className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 outline-none"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Password</label>
                        <input
                            type="password"
                            className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition">
                        Login
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-slate-400">
                    Don't have an account? <Link to="/register" className="text-blue-400 hover:underline">Register</Link>
                </p>
            </div>
        </div>
    );
}