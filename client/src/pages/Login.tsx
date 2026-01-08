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

    /**
     * Handles the login form submission
     * 
     * Flow:
     * 1. Prevents default form submission (page reload)
     * 2. Sends credentials to backend /auth/login endpoint
     * 3. Receives JWT token and userId from backend
     * 4. Stores authentication data in global state and localStorage
     * 5. Redirects user to the map page
     * 
     * Note: In production, the backend should return complete user data.
     * Currently we manually add the email since it's not returned.
     * 
     * @param e - Form submission event
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            // Send login credentials to backend
            const res = await api.post('/auth/login', { email, password });

            // Store JWT token and user data in global state and localStorage
            // Backend returns: { accessToken, user: { id, email, name } }
            setAuth(res.data.accessToken, res.data.user);

            // Navigate to the map page on successful authentication
            navigate('/map');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to login');
        }
    };

    return (
        // Full-screen centered container with dark background
        <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
            {/* Login card - white rounded box with shadow */}
            <div className="w-full max-w-md p-8 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
                {/* Page title */}
                <h2 className="text-3xl font-bold text-center text-blue-500 mb-6">Welcome Back</h2>

                {/* Error message banner - only displayed when error exists */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                {/* Login form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email input field */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Email</label>
                        <input
                            type="email"
                            className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 outline-none"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Password input field */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Password</label>
                        <input
                            type="password"
                            className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:border-blue-500 outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {/* Submit button */}
                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition">
                        Login
                    </button>
                </form>

                {/* Link to registration page for new users */}
                <p className="mt-4 text-center text-sm text-slate-400">
                    Don't have an account? <Link to="/register" className="text-blue-400 hover:underline">Register</Link>
                </p>
            </div>
        </div>
    );
}