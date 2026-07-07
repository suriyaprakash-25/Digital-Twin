import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { tryRegisterFcmToken } from '../utils/fcm';
import GoogleSignInButton from '../components/GoogleSignInButton';

const normalizeRole = (role) => {
    const r = String(role || '').trim().toLowerCase();
    if (r === 'garage' || r === 'service_center' || r === 'servicecenter' || r === 'service center') return 'GARAGE';
    if (r === 'vehicle_owner' || r === 'vehicle owner' || r === 'user' || r === 'customer' || r === 'owner') return 'USER';
    if (r === 'admin' || r === 'administrator') return 'ADMIN';
    return role || 'USER';
};

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/login`, {
                email,
                password,
            });

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // Best-effort: request permission after a user gesture (login click)
            tryRegisterFcmToken({ authToken: response.data.token, requestPermission: true }).catch(() => {
                // ignore
            });

            const role = normalizeRole(response.data.user?.role);
            if (role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate(role === 'GARAGE' ? '/garage-dashboard' : '/user-dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to login. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async (credential) => {
        setError('');
        setIsLoading(true);

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/google`, {
                credential,
            });

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            tryRegisterFcmToken({ authToken: response.data.token, requestPermission: true }).catch(() => {
                // ignore
            });

            const role = normalizeRole(response.data.user?.role);
            if (role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate(role === 'GARAGE' ? '/garage-dashboard' : '/user-dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.msg || 'Google Sign In failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleError = (err) => {
        setError(err?.message || 'Google authentication was cancelled or encountered an error.');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden px-4">
            {/* Decorative background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-teal-100 blur-[100px] opacity-60"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-teal-100 blur-[100px] opacity-60"></div>

            <div className="max-w-md w-full relative z-10 glass-card p-6 sm:p-10 rounded-3xl">
                <div className="text-center">
                    <div className="flex flex-col items-center mb-6">
                        <img src="/logo-removebg-preview.png" alt="Logo" className="h-20 sm:h-22 transform rotate-3 hover:rotate-0 transition-transform duration-300" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Welcome Back
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 font-medium">
                        Sign in to your account
                    </p>
                </div>

                <form className="mt-10 space-y-6" onSubmit={handleLogin}>
                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm text-center font-medium shadow-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                            </div>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                required
                                className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all sm:text-sm shadow-sm hover:border-slate-300"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all sm:text-sm shadow-sm hover:border-slate-300"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end">
                        <Link to="/forgot-password" className="text-sm font-medium text-teal-600 hover:text-teal-500 transition-colors">
                            Forgot your password?
                        </Link>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-600 transition-all shadow-md hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="flex-1 text-center">
                                {isLoading ? 'Signing in...' : 'Sign In'}
                            </span>
                            {!isLoading && <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all absolute right-4" />}
                        </button>
                    </div>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase font-semibold">Or continue with</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <div className="w-full">
                        <GoogleSignInButton onSuccess={handleGoogleLogin} onError={handleGoogleError} />
                    </div>

                    <div className="text-center text-sm text-slate-500 font-medium">
                        Don't have an account?{' '}
                        <Link to="/signup" className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                            Create Account
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;

