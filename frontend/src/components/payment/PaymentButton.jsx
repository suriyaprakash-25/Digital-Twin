import { useState } from 'react';
import { CreditCard, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { useCashfreeCheckout, CHECKOUT_STATUS } from '../../hooks/useCashfreeCheckout';
import { formatNumber } from '../../utils/format';

/** "Pay ₹x" button for a single service invoice, backed by the shared Cashfree checkout. */
const PaymentButton = ({ service, onPaymentSuccess, className = '' }) => {
  const { startCheckout, isBusy } = useCashfreeCheckout();
  const [errorMessage, setErrorMessage] = useState('');

  const isPaid = service.paymentStatus === 'PAID';
  const totalCost = parseFloat(service.totalCost) || 0;

  if (isPaid) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 shadow-2xs ${className}`}>
        <CheckCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        Paid
      </span>
    );
  }

  if (totalCost <= 0) return null;

  const handlePayNow = async (e) => {
    e.stopPropagation();
    if (isBusy) return;
    setErrorMessage('');

    const serviceId = service.id || service._id;
    const result = await startCheckout({
      id: serviceId,
      serviceId,
      invoiceId: service.invoiceNumber || serviceId,
      invoiceNumber: service.invoiceNumber,
    });

    if (result.status === CHECKOUT_STATUS.SUCCESS) {
      onPaymentSuccess?.(result.payment || { ...service, paymentStatus: 'PAID', paidAt: new Date().toISOString() });
    } else if (result.error) {
      setErrorMessage(result.error);
    }
  };

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handlePayNow}
        disabled={isBusy}
        aria-busy={isBusy}
        className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-95 transition-all shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 ${className}`}
      >
        {isBusy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            <span>Pay ₹{formatNumber(totalCost)}</span>
          </>
        )}
      </button>
      {errorMessage && (
        <span role="alert" className="text-[10px] font-bold text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          {errorMessage}
        </span>
      )}
    </div>
  );
};

export default PaymentButton;
