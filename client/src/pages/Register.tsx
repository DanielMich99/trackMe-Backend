/**
 * Register Component
 * 
 * User registration page that creates new accounts.
 * 
 * Flow:
 * 1. User fills in email and password
 * 2. Submits form to backend /auth/register endpoint
 * 3. On success, redirects to login page
 * 4. User must then login with their new credentials
 * 
 * Note: After registration, users must login separately.
 * In production, consider auto-login after registration.
 */

import { useState } from 'react';
import { api } from '../lib/api';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    /**
     * Handles the registration form submission
     * 
     * Flow:
     * 1. Prevents default form submission (page reload)
     * 2. Sends credentials to backend /auth/register endpoint
     * 3. On success, shows success message and redirects to login
     * 4. On error, displays error message to user
     * 
     * @param e - Form submission event
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            // Send registration request to backend
            await api.post('/auth/register', { email, password });

            // Notify user and redirect to login page
            alert('Registration successful! Please login.');
            navigate('/login');
        } catch (err: any) {
            // Display error message from backend
            setError(err.response?.data?.message || 'Failed to register');
        }
    };

    return (
        // Full-screen centered container with dark background
        <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
            {/* Registration card - white rounded box with shadow */}
            <div className="w-full max-w-md p-8 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
                {/* Page title */}
                <h2 className="text-3xl font-bold text-center text-green-500 mb-6">Create Account</h2>

                {/* Error message banner - only displayed when error exists */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                {/* Registration form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email input field */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Email</label>
                        <input
                            type="email"
                            className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:border-green-500 outline-none"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* Password input field */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Password</label>
                        <input
                            type="password"
                            className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:border-green-500 outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {/* Submit button */}
                    <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition">
                        Register
                    </button>
                </form>

                {/* Link to login page for existing users */}
                <p className="mt-4 text-center text-sm text-slate-400">
                    Already have an account? <Link to="/login" className="text-green-400 hover:underline">Login</Link>
                </p>
            </div>
        </div>
    );
}