import { useMemo, useState } from 'react';
import { CreditCard, RefreshCw } from 'lucide-react';
import RefundTrackingModal from '../components/payments/RefundTrackingModal';
import PaymentSummaryCards from '../components/payment/center/PaymentSummaryCards';
import PaymentFilters from '../components/payment/center/PaymentFilters';
import PaymentTransactionsTable from '../components/payment/center/PaymentTransactionsTable';
import InvoiceBreakdownModal from '../components/payment/center/InvoiceBreakdownModal';
import { filterPayments, isSamePayment } from '../components/payment/center/paymentFilterUtils';
import ErrorState from '../components/common/ErrorState';
import { apiGet } from '../utils/api';
import { useAsync } from '../hooks/useAsync';
import { useCashfreeCheckout, CHECKOUT_STATUS } from '../hooks/useCashfreeCheckout';
import { useToast } from '../context/toastContextCore';

async function loadFinancialData() {
  const [sumData, histData] = await Promise.all([
    apiGet('/payments/customer/financial-summary'),
    apiGet('/payments/history'),
  ]);
  return {
    summary: sumData?.success ? sumData.summary : null,
    payments: histData?.success ? histData.payments || [] : [],
  };
}

const markPaid = (p) => ({ ...p, status: 'CAPTURED', paymentStatus: 'PAID', paidAt: new Date().toISOString() });

export default function PaymentCenter() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [vehicleFilter, setVehicleFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedRefundPayment, setSelectedRefundPayment] = useState(null);

  const { data, error, loading, refreshing, refetch, setData } = useAsync(loadFinancialData, []);
  const checkout = useCashfreeCheckout();

  const summary = data?.summary || null;
  const payments = useMemo(() => data?.payments || [], [data]);
  const filteredPayments = useMemo(
    () => filterPayments(payments, { search, status: statusFilter, vehicle: vehicleFilter }),
    [payments, search, statusFilter, vehicleFilter],
  );

  const handlePayNow = async (paymentItem) => {
    if (checkout.isBusy) return;
    const result = await checkout.startCheckout({
      id: paymentItem.id,
      serviceId: paymentItem.serviceId || paymentItem.id,
      invoiceId: paymentItem.invoiceNumber || paymentItem.id,
      invoiceNumber: paymentItem.invoiceNumber,
    });

    if (result.status === CHECKOUT_STATUS.SUCCESS) {
      // Optimistic update, then a background re-sync that never blanks the table.
      setData((prev) => (prev ? { ...prev, payments: prev.payments.map((p) => (isSamePayment(p, paymentItem) ? markPaid(p) : p)) } : prev));
      setSelectedInvoice((prev) => (isSamePayment(prev, paymentItem) ? markPaid(prev) : prev));
      showToast('Payment successful! Your invoice has been settled.', 'success');
      refetch({ silent: true });
    } else if (result.status === CHECKOUT_STATUS.PENDING) {
      showToast(result.error || 'Payment verification pending. Please check again in a moment.', 'warning');
      refetch({ silent: true });
    } else if (result.status === CHECKOUT_STATUS.FAILED) {
      showToast(result.error || 'Unable to initialize payment', 'error');
    }
  };

  const isPaying = (id) => checkout.isBusyFor(id);

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-600 shadow-sm">
                <CreditCard className="w-6 h-6" aria-hidden="true" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Payment Center</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Manage your service payments, tax invoices, and track refund lifecycles in real-time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch({ silent: true })}
            disabled={loading || refreshing}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium transition shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 text-teal-600 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
          </button>
        </div>

        {error && <ErrorState title="Could not load your payments" message={error} onRetry={() => refetch()} retrying={loading} />}

        <PaymentSummaryCards summary={summary} />

        <PaymentFilters
          search={search}
          onSearchChange={setSearch}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          vehicle={vehicleFilter}
          onVehicleChange={setVehicleFilter}
          vehicles={summary?.vehicles || []}
        />

        <PaymentTransactionsTable
          payments={filteredPayments}
          loading={loading && !data}
          isPaying={isPaying}
          payDisabled={checkout.isBusy}
          onViewInvoice={setSelectedInvoice}
          onTrackRefund={setSelectedRefundPayment}
          onPay={handlePayNow}
        />

        <InvoiceBreakdownModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPay={handlePayNow}
          paying={selectedInvoice ? isPaying(selectedInvoice.id) : false}
          payDisabled={checkout.isBusy}
        />

        {selectedRefundPayment && (
          <RefundTrackingModal
            payment={selectedRefundPayment}
            onClose={() => setSelectedRefundPayment(null)}
          />
        )}
      </div>
    </div>
  );
}
