import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { homePathForRole } from '../utils/roles';
import { apiPost, getErrorMessage } from '../utils/api';
import { useAuth } from '../context/authContextCore';
import { registerPushAfterLogin } from '../utils/pushRegistration';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    // Store the session, register push (best effort, after a user gesture) and go home.
    const completeLogin = (data) => {
        login({ token: data.token, user: data.user });
        registerPushAfterLogin();
        navigate(homePathForRole(data.user?.role));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const data = await apiPost('/auth/login', {
                email,
                password,
            });
            completeLogin(data);
        } catch (err) {
            // Includes the 429 RATE_LIMIT_EXCEEDED message from the backend.
            setError(getErrorMessage(err, 'Failed to login. Please try again.'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async (credential) => {
        setError('');
        setIsLoading(true);

        try {
            const data = await apiPost('/auth/google', {
                credential,
            });
            completeLogin(data);
        } catch (err) {
            setError(getErrorMessage(err, 'Google Sign In failed. Please try again.'));
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
                        <div role="alert" className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm text-center font-medium shadow-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        <div className="relative group">
                            <label htmlFor="email-address" className="sr-only">Email address</label>
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                            </div>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all sm:text-sm shadow-sm hover:border-slate-300"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="relative group">
                            <label htmlFor="password" className="sr-only">Password</label>
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                            </div>
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                required
                                className="block w-full pl-11 pr-12 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all sm:text-sm shadow-sm hover:border-slate-300"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                aria-pressed={showPassword}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                                ) : (
                                    <Eye className="h-5 w-5" aria-hidden="true" />
                                )}
                            </button>
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
                            <span className="flex items-center justify-center gap-2">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
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

