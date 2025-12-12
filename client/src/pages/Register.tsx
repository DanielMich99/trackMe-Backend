import { useState } from 'react';
import { api } from '../lib/api';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            await api.post('/auth/register', { email, password });
            alert('Registration successful! Please login.');
            navigate('/login');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to register');
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
            <div className="w-full max-w-md p-8 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
                <h2 className="text-3xl font-bold text-center text-green-500 mb-6">Create Account</h2>

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
                            className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:border-green-500 outline-none"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Password</label>
                        <input
                            type="password"
                            className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:border-green-500 outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition">
                        Register
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-slate-400">
                    Already have an account? <Link to="/login" className="text-green-400 hover:underline">Login</Link>
                </p>
            </div>
        </div>
    );
}