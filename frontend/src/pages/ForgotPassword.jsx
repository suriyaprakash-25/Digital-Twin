import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await axios.post('http://localhost:5000/api/auth/forgot-password', { email });
      if (res.data.success) {
        setMessage('OTP sent successfully. Redirecting...');
        setTimeout(() => {
          navigate('/verify-otp', { state: { email } });
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-teal-900/5 p-8 border border-slate-100 relative overflow-hidden">
          
          {/* Background decoration */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center transform rotate-3 shadow-inner">
                <ShieldCheck className="h-8 w-8 text-teal-600" />
              </div>
            </div>

            <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-2 tracking-tight">
              Forgot Password
            </h2>
            <p className="text-slate-500 text-center text-sm mb-8">
              Enter your registered email and we'll send you an OTP to reset your password.
            </p>

            {message && (
              <div className="mb-6 p-4 bg-teal-50 border border-teal-100 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <p className="text-teal-800 text-sm font-medium">{message}</p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-red-600 text-sm text-center font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none text-slate-900 font-medium"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || message}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending OTP...
                  </>
                ) : message ? (
                  'OTP Sent'
                ) : (
                  'Send OTP'
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <Link 
                to="/login" 
                className="inline-flex items-center text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ForgotPassword;
