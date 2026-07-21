import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Lock, Mail, User, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import GoogleSignInButton from '../components/GoogleSignInButton';
import TermsConditionsModal from '../components/TermsConditionsModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';

const Signup = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'vehicle_owner'
    });
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!termsAccepted || !privacyAccepted) {
            setError('You must accept the Partner Terms & Conditions and Privacy Policy before creating an account.');
            return;
        }

        setIsLoading(true);

        try {
            await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/signup`, {
                ...formData,
                termsAccepted,
                privacyAccepted
            });
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to create account. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignup = async (credential) => {
        setError('');
        
        if (!termsAccepted || !privacyAccepted) {
            setError('You must accept the Partner Terms & Conditions and Privacy Policy before creating an account.');
            return;
        }

        setIsLoading(true);

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/google`, {
                credential,
                role: formData.role,
                termsAccepted,
                privacyAccepted
            });

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            const role = response.data.user?.role;
            if (role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate(role === 'GARAGE' ? '/garage-dashboard' : '/user-dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.msg || 'Google Sign Up failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleError = (err) => {
        setError(err?.message || 'Google authentication was cancelled or encountered an error.');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden px-4 py-12">
            {/* Decorative background elements */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-100 blur-[100px] opacity-60"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-teal-100 blur-[100px] opacity-60"></div>

            <div className="max-w-md w-full relative z-10 glass-card p-6 sm:p-10 rounded-3xl">
                <div className="text-center">
                    <div className="flex flex-col items-center mb-6">
                        <img src="/logo-removebg-preview.png" alt="Logo" className="h-20 sm:h-22 transform -rotate-3 hover:rotate-0 transition-transform duration-300" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Create Account
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 font-medium">
                        Join today
                    </p>
                </div>

                <form className="mt-10 space-y-6" onSubmit={handleSignup}>
                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm text-center font-medium shadow-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            </div>
                            <input
                                name="name"
                                type="text"
                                required
                                className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm shadow-sm hover:border-slate-300"
                                placeholder="Full Name"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            </div>
                            <input
                                name="email"
                                type="email"
                                required
                                className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm shadow-sm hover:border-slate-300"
                                placeholder="Email address"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            </div>
                            <input
                                name="password"
                                type="password"
                                required
                                className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm shadow-sm hover:border-slate-300"
                                placeholder="Password"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <ShieldCheck className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            </div>
                            <select
                                name="role"
                                className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm shadow-sm hover:border-slate-300 appearance-none font-medium"
                                value={formData.role}
                                onChange={handleChange}
                            >
                                <option value="vehicle_owner">Vehicle Owner</option>
                                <option value="garage">Garage / Service Center</option>
                            </select>
                        </div>
                    </div>

                    {/* Acceptance Checkbox */}
                    <div className="flex items-start gap-3 px-1">
                        <div className="flex items-center h-5">
                            <input
                                id="legal-acceptance"
                                type="checkbox"
                                checked={termsAccepted && privacyAccepted}
                                onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    setTermsAccepted(isChecked);
                                    setPrivacyAccepted(isChecked);
                                    if (isChecked) setError('');
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                        </div>
                        <label htmlFor="legal-acceptance" className="text-sm text-slate-600 leading-snug">
                            I agree to the{' '}
                            <button 
                                type="button" 
                                onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }}
                                className="font-bold text-slate-800 hover:text-emerald-600 transition-colors underline decoration-slate-300 hover:decoration-emerald-500 underline-offset-2"
                            >
                                Terms & Conditions
                            </button>{' '}
                            and{' '}
                            <button 
                                type="button" 
                                onClick={(e) => { e.preventDefault(); setShowPrivacyModal(true); }}
                                className="font-bold text-slate-800 hover:text-emerald-600 transition-colors underline decoration-slate-300 hover:decoration-emerald-500 underline-offset-2"
                            >
                                Privacy Policy
                            </button>.
                        </label>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading || (!termsAccepted || !privacyAccepted)}
                            className="group relative w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-600 transition-all shadow-md hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="flex-1 text-center">
                                {isLoading ? 'Creating Account...' : 'Sign Up'}
                            </span>
                            {!isLoading && <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all absolute right-4" />}
                        </button>
                    </div>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase font-semibold">Or continue with</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <div className="w-full relative">
                        {(!termsAccepted || !privacyAccepted) && (
                            <div 
                                className="absolute inset-0 z-10 cursor-not-allowed"
                                onClick={() => setError('You must accept the Terms & Conditions and Privacy Policy before creating an account.')}
                                title="Please accept the terms before using Google Sign Up"
                            />
                        )}
                        <div className={(!termsAccepted || !privacyAccepted) ? 'opacity-50 pointer-events-none' : ''}>
                            <GoogleSignInButton onSuccess={handleGoogleSignup} onError={handleGoogleError} text="signup_with" />
                        </div>
                    </div>

                    <div className="text-center text-sm text-slate-500 font-medium">
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                            Sign In
                        </Link>
                    </div>
                </form>
            </div>

            <TermsConditionsModal 
                isOpen={showTermsModal} 
                onClose={() => setShowTermsModal(false)}
                onAccept={() => {
                    setTermsAccepted(true);
                    if (privacyAccepted) setError('');
                    setShowTermsModal(false);
                }}
            />

            <PrivacyPolicyModal 
                isOpen={showPrivacyModal} 
                onClose={() => setShowPrivacyModal(false)}
                onAccept={() => {
                    setPrivacyAccepted(true);
                    if (termsAccepted) setError('');
                    setShowPrivacyModal(false);
                }}
            />
        </div>
    );
};

export default Signup;

