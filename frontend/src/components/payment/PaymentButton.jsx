import { API_BASE_URL } from '../../utils/config';
import { useState } from 'react';
import axios from 'axios';
import { CreditCard, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { loadCashfreeScript } from '../../utils/loadCashfree';

const CASHFREE_MODE = import.meta.env.VITE_CASHFREE_MODE || 'sandbox'; // 'sandbox' | 'production'

const PaymentButton = ({ service, onPaymentSuccess, className = '' }) => {
  const [loading, setLoading]           = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isPaid     = service.paymentStatus === 'PAID';
  const totalCost  = parseFloat(service.totalCost) || 0;

  if (isPaid) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 shadow-2xs ${className}`}>
        <CheckCircle className="h-4 w-4 text-emerald-600" />
        Paid
      </span>
    );
  }

  if (totalCost <= 0) return null;

  const handlePayNow = async (e) => {
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    setErrorMessage('');

    try {
      // 1. Load Cashfree Drop.js SDK
      const isLoaded = await loadCashfreeScript();
      if (!isLoaded) {
        setErrorMessage('Failed to load Cashfree checkout. Please check your internet connection.');
        setLoading(false);
        return;
      }

      const token       = localStorage.getItem('token');
      const userRaw     = localStorage.getItem('user');
      const user        = userRaw ? JSON.parse(userRaw) : {};
      const apiBaseUrl  = API_BASE_URL;

      // 2. Create Cashfree Order on the server
      const targetServiceId = service.id || service._id;
      const orderResponse = await axios.post(
        `${apiBaseUrl}/api/payments/create-order`,
        {
          serviceId:  targetServiceId,
          invoiceId:  service.invoiceNumber || targetServiceId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const resData = orderResponse.data;
      if (!resData?.success) {
        throw new Error(resData?.message || 'Failed to generate payment order');
      }

      const { cfOrderId, paymentSessionId } = resData;
      if (!paymentSessionId) {
        throw new Error('Missing payment session ID from server. Please contact support.');
      }

      // 3. Initialize Cashfree Drop.js and open checkout
      const cashfree = window.Cashfree({ mode: CASHFREE_MODE });

      const checkoutOptions = {
        paymentSessionId,
        redirectTarget: '_modal',    // Opens inline modal; use '_self' or '_blank' for redirect
        onSuccess: async (data) => {
          // data.order.orderId is the cfOrderId
          const confirmedOrderId = data?.order?.orderId || cfOrderId;
          try {
            const verifyRes = await axios.post(
              `${apiBaseUrl}/api/payments/verify`,
              {
                cfOrderId:  confirmedOrderId,
                orderId:    confirmedOrderId,
                serviceId:  targetServiceId,
                invoiceNumber: service.invoiceNumber
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (verifyRes.data?.success) {
              setErrorMessage('');
              if (onPaymentSuccess) {
                onPaymentSuccess(
                  verifyRes.data.payment || {
                    ...service,
                    paymentStatus: 'PAID',
                    paidAt: new Date().toISOString()
                  }
                );
              }
            } else {
              setErrorMessage('Payment verification failed. Please contact support.');
            }
          } catch (verifyErr) {
            console.error('Payment verification error:', verifyErr);
            setErrorMessage(verifyErr.response?.data?.message || 'Payment verification failed');
          } finally {
            setLoading(false);
          }
        },
        onFailure: (data) => {
          console.error('Cashfree payment failed:', data);
          const msg = data?.order?.errorText || data?.transaction?.txMsg || 'Transaction declined';
          setErrorMessage(`Payment failed: ${msg}`);
          setLoading(false);
        },
        onClose: () => {
          // User dismissed the modal without completing payment
          setLoading(false);
        }
      };

      await cashfree.checkout(checkoutOptions);
    } catch (err) {
      console.error('Error starting payment:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Unable to initialize payment');
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handlePayNow}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-95 transition-all shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            <span>Pay ₹{totalCost.toLocaleString('en-IN')}</span>
          </>
        )}
      </button>
      {errorMessage && (
        <span className="text-[10px] font-bold text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {errorMessage}
        </span>
      )}
    </div>
  );
};

export default PaymentButton;
