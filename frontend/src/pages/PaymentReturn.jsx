import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
  ArrowRight,
  ShieldCheck,
  Home,
  RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../utils/config';

export default function PaymentReturn() {
  const location = useLocation();
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [payment, setPayment] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(6);

  // Extract order_id from query parameters (Cashfree appends ?order_id=...)
  const searchParams = new URLSearchParams(location.search);
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');

  useEffect(() => {
    let isMounted = true;

    async function verifyOrder() {
      if (!orderId) {
        setVerifying(false);
        setErrorMessage('No order reference found in URL. Please visit the Payment Center to check status.');
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await axios.post(
          `${API_BASE_URL}/api/payments/verify`,
          { cfOrderId: orderId, orderId },
          { headers }
        );

        if (!isMounted) return;

        if (res.data?.success) {
          setPayment(res.data.payment || { cfOrderId: orderId, status: 'CAPTURED' });
          setVerifying(false);
        } else {
          setErrorMessage(res.data?.message || 'Payment status could not be verified yet.');
          setVerifying(false);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('PaymentReturn verification error:', err);
        setErrorMessage(
          err.response?.data?.message ||
          'Payment confirmation is still processing. If money was debited, your invoice will update shortly.'
        );
        setVerifying(false);
      }
    }

    verifyOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // Auto-redirect timer on success
  useEffect(() => {
    if (!payment || verifying) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/payments');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [payment, verifying, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden text-center transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header Accent Banner */}
        <div className={`h-3 w-full ${verifying ? 'bg-teal-500 animate-pulse' : payment ? 'bg-emerald-500' : 'bg-amber-500'}`} />

        <div className="p-6 md:p-8">
          {/* STATE 1: Verifying */}
          {verifying && (
            <div className="py-8 flex flex-col items-center">
              <div className="relative mb-5">
                <div className="w-20 h-20 rounded-full bg-teal-50 flex items-center justify-center border border-teal-100">
                  <Loader2 className="h-10 w-10 text-teal-600 animate-spin" />
                </div>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">
                Verifying Your Payment
              </h2>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Please wait a moment while we confirm your transaction securely with Cashfree...
              </p>
              {orderId && (
                <p className="mt-4 font-mono text-[11px] text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-200/60">
                  Ref: {orderId}
                </p>
              )}
            </div>
          )}

          {/* STATE 2: Success */}
          {!verifying && payment && (
            <div className="py-4 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4 shadow-sm animate-in zoom-in duration-300">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>

              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                Payment Successful!
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Your service invoice has been settled and verified.
              </p>

              {/* Transaction Receipt Card */}
              <div className="w-full bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 mb-6 text-left space-y-2.5">
                {payment.amount && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-xs font-semibold text-slate-500">Amount Paid</span>
                    <span className="text-base font-black text-slate-900">
                      ₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {payment.invoiceNumber && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">Invoice Number</span>
                    <span className="font-mono font-bold text-teal-700">{payment.invoiceNumber}</span>
                  </div>
                )}
                {payment.vehicleNumber && payment.vehicleNumber !== 'N/A' && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">Vehicle</span>
                    <span className="font-mono font-bold text-slate-800">{payment.vehicleNumber}</span>
                  </div>
                )}
                {orderId && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">Order Reference</span>
                    <span className="font-mono text-[11px] text-slate-600 truncate max-w-[180px]">{orderId}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="font-semibold text-slate-500">Gateway</span>
                  <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                    <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                    Cashfree Verified
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-2.5">
                <Link
                  to="/payments"
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold text-sm shadow-sm transition-all"
                >
                  <Receipt className="h-4 w-4" />
                  <span>View in Payment Center</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>

                <Link
                  to="/user-dashboard"
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                >
                  <Home className="h-3.5 w-3.5 text-slate-400" />
                  <span>Go to Dashboard</span>
                </Link>
              </div>

              <p className="mt-4 text-[11px] text-slate-400">
                Redirecting automatically in <span className="font-bold text-teal-600">{countdown}s</span>...
              </p>
            </div>
          )}

          {/* STATE 3: Unconfirmed / Error */}
          {!verifying && !payment && (
            <div className="py-4 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 shadow-sm">
                <AlertCircle className="h-10 w-10 text-amber-600" />
              </div>

              <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">
                Payment Incomplete or Processing
              </h2>
              <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                {errorMessage}
              </p>

              <div className="w-full space-y-2.5">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold text-sm shadow-sm transition-all"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Check Status Again</span>
                </button>

                <Link
                  to="/payments"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
                >
                  <span>Return to Payment Center</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
