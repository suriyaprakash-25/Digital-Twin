import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { KeyRound, ArrowLeft, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastContext';

function VerifyOtp() {
  const { showToast } = useToast();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/verify-otp`, { email, otp });
      if (res.data.success) {
        showToast('OTP verified successfully! Redirecting...', 'success');
        setTimeout(() => {
          navigate('/reset-password', { state: { email, otp } });
        }, 1500);
      }
    } catch (err) {
      showToast(err.response?.data?.msg || 'An error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/forgot-password`, { email });
      if (res.data.success) {
        showToast('A new OTP has been sent to your email.', 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.msg || 'Failed to resend OTP.', 'error');
    } finally {
      setResending(false);
    }
  };

  if (!email) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-teal-900/5 p-8 border border-slate-100 relative overflow-hidden">
          
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center transform -rotate-3 shadow-inner">
                <KeyRound className="h-8 w-8 text-teal-600" />
              </div>
            </div>

            <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-2 tracking-tight">
              Verify OTP
            </h2>
            <p className="text-slate-500 text-center text-sm mb-8">
              We've sent a 6-digit code to <span className="font-semibold text-slate-700">{email}</span>.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 text-center">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} // only allow numbers
                  className="block w-full py-4 text-center text-3xl tracking-[1em] font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all outline-none"
                  placeholder="------"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 6 || message.includes('Redirecting')}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Code'
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-4">
              <div>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${resending ? 'animate-spin' : ''}`} />
                  Didn't receive the code? Resend
                </button>
              </div>
              <div>
                <Link 
                  to="/forgot-password" 
                  className="inline-flex items-center text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Change Email
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default VerifyOtp;
