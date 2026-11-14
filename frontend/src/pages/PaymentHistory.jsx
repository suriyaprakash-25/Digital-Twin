import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, IndianRupee, ArrowLeft, Search, Receipt, AlertTriangle } from 'lucide-react';
import InvoiceModal from '../components/invoice/InvoiceModal';
import ReceiptModal from '../components/invoice/ReceiptModal';
import PaymentDetailsModal from '../components/payment/PaymentDetailsModal';
import PaymentHistoryCard from '../components/payment/PaymentHistoryCard';
import CreateDisputeModal from '../components/dispute/CreateDisputeModal';
import ErrorState from '../components/common/ErrorState';
import { apiGet } from '../utils/api';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../context/toastContextCore';

const PaymentHistory = () => {
  const { showSuccess } = useToast();
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState(null);
  const [selectedPaymentForDispute, setSelectedPaymentForDispute] = useState(null);

  const { data, error, loading, refetch } = useAsync(async () => {
    const res = await apiGet('/payments/history', { status: statusFilter, search: submittedSearch });
    return res?.success ? res.payments || [] : [];
  }, [statusFilter, submittedSearch]);

  const payments = data || [];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (search === submittedSearch) refetch();
    else setSubmittedSearch(search);
  };

  const totalPaid = payments
    .filter((p) => p.status === 'CAPTURED' || p.status === 'PAID')
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const totalRefunded = payments
    .reduce((sum, p) => sum + (parseFloat(p.totalRefundedAmount) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Back button */}
      <Link
        to="/user-dashboard"
        className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-teal-600 mb-6 transition-colors bg-white px-4 py-2 border border-slate-200 rounded-xl shadow-xs hover:shadow-sm"
      >
        <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <header className="bg-white border border-slate-100 p-6 md:p-8 rounded-3xl shadow-sm mb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-bold text-teal-600 uppercase tracking-widest">
                Billing & Transactions
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Payment History
            </h1>
            <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">
              Authoritative transaction logs verified through our payment gateway &amp; DrivePortz
            </p>
            <Link to="/my-disputes" className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-amber-700 hover:underline">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> View my disputes
            </Link>
          </div>

          {/* Stats summary */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                Total Settled
              </span>
              <span className="text-xl md:text-2xl font-black text-slate-900 flex items-center justify-end tracking-tight">
                <IndianRupee className="h-4 w-4 md:h-5 md:w-5 mr-0.5 text-slate-400" />
                {totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {totalRefunded > 0 && (
                <span className="text-[10px] font-bold text-violet-600 block mt-0.5">
                  ₹{totalRefunded.toLocaleString('en-IN')} Refunded
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs mb-6 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3" role="search">
          <Search className="h-5 w-5 text-slate-400 shrink-0 ml-1" aria-hidden="true" />
          <label htmlFor="payment-history-search" className="sr-only">Search payments</label>
          <input
            id="payment-history-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number, vehicle number, service, or garage..."
            className="w-full bg-transparent border-0 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSubmittedSearch(''); }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2.5 py-1 bg-slate-100 rounded-lg shrink-0"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 shadow-2xs"
          >
            Search
          </button>
        </form>

        <div role="group" aria-label="Filter by status" className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-50">
          {['ALL', 'PAID', 'REFUNDED', 'FAILED', 'PENDING'].map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {status === 'ALL' ? 'All Transactions' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && !data ? (
        <div role="status" aria-label="Loading payments" className="flex justify-center items-center py-20 bg-white rounded-3xl border border-slate-100">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
        </div>
      ) : error ? (
        <ErrorState title="Failed to load payment history" message={error} onRetry={() => refetch()} retrying={loading} />
      ) : payments.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-16 text-center shadow-xs">
          <div className="mx-auto h-20 w-20 bg-teal-50 rounded-2xl flex items-center justify-center border border-teal-100 mb-4 text-teal-600">
            <Receipt className="h-10 w-10" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">
            {submittedSearch ? 'No Matching Transactions' : 'No Payment History Yet'}
          </h2>
          <p className="text-slate-500 max-w-md mx-auto text-xs md:text-sm font-medium">
            {submittedSearch
              ? 'No payments found matching your search query. Try clearing the filter.'
              : 'When you settle automotive service invoices online, your official payment receipts and transaction records will appear here.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {payments.map((p) => (
            <PaymentHistoryCard
              key={p.id}
              payment={p}
              onDetails={setSelectedPaymentForDetails}
              onInvoice={setSelectedInvoiceId}
              onReceipt={setSelectedReceiptId}
              onDispute={setSelectedPaymentForDispute}
            />
          ))}
        </ul>
      )}

      {/* Payment Details Audit Modal */}
      {selectedPaymentForDetails && (
        <PaymentDetailsModal
          isOpen={Boolean(selectedPaymentForDetails)}
          onClose={() => setSelectedPaymentForDetails(null)}
          paymentData={selectedPaymentForDetails}
          onViewInvoice={(sId) => setSelectedInvoiceId(sId)}
          onViewReceipt={(sId) => setSelectedReceiptId(sId)}
        />
      )}

      {/* Tax Invoice Modal */}
      {selectedInvoiceId && (
        <InvoiceModal
          isOpen={Boolean(selectedInvoiceId)}
          onClose={() => setSelectedInvoiceId(null)}
          serviceId={selectedInvoiceId}
          onViewReceipt={(inv) => setSelectedReceiptId(inv.id || inv._id)}
        />
      )}

      {/* Receipt Modal */}
      {selectedReceiptId && (
        <ReceiptModal
          isOpen={Boolean(selectedReceiptId)}
          onClose={() => setSelectedReceiptId(null)}
          serviceId={selectedReceiptId}
        />
      )}

      {/* Raise Dispute Modal */}
      {selectedPaymentForDispute && (
        <CreateDisputeModal
          isOpen={Boolean(selectedPaymentForDispute)}
          onClose={() => setSelectedPaymentForDispute(null)}
          payment={selectedPaymentForDispute}
          onSuccess={() => {
            showSuccess('Dispute submitted successfully! You can track it in My Disputes.');
            setSelectedPaymentForDispute(null);
          }}
        />
      )}
    </div>
  );
};

export default PaymentHistory;
