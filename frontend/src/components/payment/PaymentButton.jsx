import { useState } from 'react';
import axios from 'axios';
import { CreditCard, CheckCircle, Loader2, IndianRupee, AlertCircle } from 'lucide-react';
import { loadRazorpayScript } from '../../utils/loadRazorpay';

const PaymentButton = ({ service, vehicle, onPaymentSuccess, className = '' }) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isPaid = service.paymentStatus === 'PAID';
  const totalCost = parseFloat(service.totalCost) || 0;

  if (isPaid) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 shadow-2xs ${className}`}>
        <CheckCircle className="h-4 w-4 text-emerald-600" />
        Paid
      </span>
    );
  }

  if (totalCost <= 0) {
    return null;
  }

  const handlePayNow = async (e) => {
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    setErrorMessage('');

    try {
      // 1. Ensure Razorpay SDK is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        setErrorMessage('Failed to load Razorpay checkout script. Please check your internet connection.');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const userRaw = localStorage.getItem('user');
      const user = userRaw ? JSON.parse(userRaw) : {};
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      // 2. Create server-side Razorpay Order
      const orderResponse = await axios.post(
        `${apiBaseUrl}/api/payments/create-order`,
        { serviceId: service.id || service._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const orderData = orderResponse.data;
      if (!orderData || !orderData.orderId) {
        throw new Error(orderData?.message || 'Failed to generate payment order');
      }

      const razorpayKey = orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder';

      // 3. Configure Razorpay Standard Checkout
      const options = {
        key: razorpayKey,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'DrivePortz',
        description: `${service.serviceType || 'Service'} - ${vehicle?.vehicleNumber || 'Vehicle'}`,
        image: '/logo-removebg-preview.png',
        order_id: orderData.orderId,
        prefill: {
          name: user.name || '',
          email: user.email || '',
          contact: user.phone || ''
        },
        theme: {
          color: '#0d9488' // DrivePortz Teal
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          }
        },
        handler: async (response) => {
          try {
            // 4. Send signature to backend for verification
            const verifyRes = await axios.post(
              `${apiBaseUrl}/api/payments/verify`,
              {
                paymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                serviceId: service.id || service._id
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (verifyRes.data?.success) {
              if (onPaymentSuccess) {
                onPaymentSuccess(verifyRes.data.payment);
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
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        console.error('Razorpay payment failed:', response.error);
        setErrorMessage(`Payment failed: ${response.error?.description || 'Transaction declined'}`);
        setLoading(false);
      });

      rzp.open();
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
