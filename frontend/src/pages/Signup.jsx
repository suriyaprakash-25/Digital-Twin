import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Car, Lock, Mail, User, ShieldCheck, ArrowRight } from 'lucide-react';

const Signup = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'vehicle_owner'
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await axios.post('http://localhost:5000/api/auth/signup', formData);
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to create account. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden px-4 py-12">
            {/* Decorative background elements */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-100 blur-[100px] opacity-60"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-100 blur-[100px] opacity-60"></div>

            <div className="max-w-md w-full relative z-10 glass-card p-10 rounded-3xl">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                        <Car className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        Create Account
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 font-medium">
                        Join Mobility Digital Twin today
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

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-all shadow-md hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="flex-1 text-center">
                                {isLoading ? 'Creating Account...' : 'Sign Up'}
                            </span>
                            {!isLoading && <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all absolute right-4" />}
                        </button>
                    </div>

                    <div className="text-center text-sm text-slate-500 font-medium">
                        Already have an account?{' '}
                        <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                            Sign In
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Signup;
