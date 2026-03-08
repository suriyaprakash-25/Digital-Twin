import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Car, Lock, Mail, ArrowRight } from 'lucide-react';
import { tryRegisterFcmToken } from '../utils/fcm';

const normalizeRole = (role) => {
    const r = String(role || '').trim().toLowerCase();
    if (r === 'garage' || r === 'service_center' || r === 'servicecenter' || r === 'service center') return 'GARAGE';
    if (r === 'vehicle_owner' || r === 'vehicle owner' || r === 'user' || r === 'customer' || r === 'owner') return 'USER';
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
            const response = await axios.post('http://localhost:5000/api/auth/login', {
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
            navigate(role === 'GARAGE' ? '/garage-dashboard' : '/user-dashboard');
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to login. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden px-4">
            {/* Decorative background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-100 blur-[100px] opacity-60"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-100 blur-[100px] opacity-60"></div>

            <div className="max-w-md w-full relative z-10 glass-card p-10 rounded-3xl">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-6 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                        <Car className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        Welcome Back
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 font-medium">
                        Sign in to access your digital twin dashboard
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
                                <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                required
                                className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm shadow-sm hover:border-slate-300"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm shadow-sm hover:border-slate-300"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-md hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="flex-1 text-center">
                                {isLoading ? 'Signing in...' : 'Sign In'}
                            </span>
                            {!isLoading && <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all absolute right-4" />}
                        </button>
                    </div>

                    <div className="text-center text-sm text-slate-500 font-medium">
                        Don't have an account?{' '}
                        <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                            Create Account
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
