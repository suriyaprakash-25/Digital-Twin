import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Lock, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;
  const otp = location.state?.otp;

  useEffect(() => {
    // If accessed directly without going through the OTP flow, redirect back
    if (!email || !otp) {
      navigate('/forgot-password');
    }
  }, [email, otp, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/reset-password`, { 
        email, 
        otp, 
        newPassword 
      });

      if (res.data.success) {
        setMessage('Password updated successfully! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!email || !otp) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-teal-900/5 p-8 border border-slate-100 relative overflow-hidden">
          
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center transform rotate-3 shadow-inner">
                <Lock className="h-8 w-8 text-teal-600" />
              </div>
            </div>

            <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-2 tracking-tight">
              Reset Password
            </h2>
            <p className="text-slate-500 text-center text-sm mb-8">
              Please enter your new password below.
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
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none text-slate-900 font-medium"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none text-slate-900 font-medium"
                  placeholder="••••••••"
                />
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                <p className="font-semibold text-slate-700 mb-2">Password must contain:</p>
                <p className={newPassword.length >= 8 ? 'text-teal-600' : ''}>• At least 8 characters</p>
                <p className={/[A-Z]/.test(newPassword) ? 'text-teal-600' : ''}>• One uppercase letter</p>
                <p className={/[a-z]/.test(newPassword) ? 'text-teal-600' : ''}>• One lowercase letter</p>
                <p className={/\d/.test(newPassword) ? 'text-teal-600' : ''}>• One number</p>
                <p className={/[@$!%*?&]/.test(newPassword) ? 'text-teal-600' : ''}>• One special character (@$!%*?&)</p>
              </div>

              <button
                type="submit"
                disabled={loading || message.includes('Redirecting')}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Reset Password'
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

export default ResetPassword;
