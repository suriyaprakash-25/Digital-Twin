import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  CreditCard,
  IndianRupee,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Building,
  Car,
  Search,
  ExternalLink,
  ShieldCheck,
  Receipt,
  RotateCcw,
  FileText,
  Eye,
  RefreshCw
} from 'lucide-react';
import InvoiceModal from '../components/invoice/InvoiceModal';
import ReceiptModal from '../components/invoice/ReceiptModal';
import PaymentDetailsModal from '../components/payment/PaymentDetailsModal';

const PaymentHistory = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState('');

  // Modals
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState(null);

  const fetchPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const res = await axios.get(
        `${apiBaseUrl}/api/payments/history?status=${statusFilter}&search=${encodeURIComponent(search)}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data?.success) {
        setPayments(res.data.payments || []);
      }
    } catch (err) {
      console.error('Error loading payment history:', err);
      setError('Failed to load payment history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPayments();
  };

  const totalPaid = payments
    .filter((p) => p.status === 'CAPTURED' || p.status === 'PAID')
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const totalRefunded = payments
    .reduce((sum, p) => sum + (parseFloat(p.totalRefundedAmount) || 0), 0);

  const getStatusBadge = (status, totalRefundedAmt = 0) => {
    if (status === 'CAPTURED' || status === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          PAID
        </span>
      );
    } else if (status === 'REFUNDED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200">
          <RotateCcw className="h-3.5 w-3.5 text-violet-600" />
          REFUNDED
        </span>
      );
    } else if (status === 'PARTIALLY_REFUNDED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200">
          <RotateCcw className="h-3.5 w-3.5 text-purple-600" />
          PARTIAL REFUND (₹{totalRefundedAmt})
        </span>
      );
    } else if (status === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-red-700 bg-red-50 border border-red-200">
          <AlertCircle className="h-3.5 w-3.5 text-red-600" />
          FAILED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
        <Clock className="h-3.5 w-3.5 text-amber-600" />
        {status || 'PENDING'}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Back button */}
      <Link
        to="/user-dashboard"
        className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-teal-600 mb-6 transition-colors bg-white px-4 py-2 border border-slate-200 rounded-xl shadow-xs hover:shadow-sm"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <header className="bg-white border border-slate-100 p-6 md:p-8 rounded-3xl shadow-sm mb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
                <CreditCard className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold text-teal-600 uppercase tracking-widest">
                Billing & Transactions
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Payment History
            </h1>
            <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">
              Authoritative transaction logs verified through Razorpay & DrivePortz
            </p>
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
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
          <Search className="h-5 w-5 text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number, vehicle number, service, or garage..."
            className="w-full bg-transparent border-0 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); fetchPayments(); }}
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

        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-50">
          {['ALL', 'PAID', 'REFUNDED', 'FAILED', 'PENDING'].map((status) => (
            <button
              key={status}
              type="button"
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
      {loading ? (
        <div className="flex justify-center items-center py-20 bg-white rounded-3xl border border-slate-100">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center text-sm font-bold flex items-center justify-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-16 text-center shadow-xs">
          <div className="mx-auto h-20 w-20 bg-teal-50 rounded-2xl flex items-center justify-center border border-teal-100 mb-4 text-teal-600">
            <Receipt className="h-10 w-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-1">
            {search ? 'No Matching Transactions' : 'No Payment History Yet'}
          </h3>
          <p className="text-slate-500 max-w-md mx-auto text-xs md:text-sm font-medium">
            {search
              ? 'No payments found matching your search query. Try clearing the filter.'
              : 'When you settle automotive service invoices online, your official payment receipts and transaction records will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((p) => {
            const isSuccess = p.status === 'CAPTURED' || p.status === 'PAID';
            const isFailed = p.status === 'FAILED';
            const isRefunded = p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED';

            return (
              <div
                key={p.id}
                className="bg-white border border-slate-100 hover:border-teal-200 rounded-2xl p-5 md:p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(p.status, p.totalRefundedAmount)}

                    {p.invoiceNumber && (
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                        {p.invoiceNumber}
                      </span>
                    )}

                    <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100 flex items-center gap-1">
                      <Car className="h-3 w-3" />
                      {p.vehicleNumber}
                    </span>

                    <span className="text-xs font-semibold text-slate-400">
                      {p.date
                        ? new Date(p.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '—'}
                    </span>
                  </div>

                  <h4 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">
                    {p.serviceType}
                  </h4>

                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Building className="h-3.5 w-3.5 text-slate-400" />
                      {p.garageName}
                    </span>
                    {p.paymentId && p.paymentId !== '—' && (
                      <span className="font-mono text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        ID: {p.paymentId}
                      </span>
                    )}
                    {p.paymentMethod && (
                      <span className="text-slate-400">
                        Method: <strong className="text-slate-600">{p.paymentMethod}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right amount and actions */}
                <div className="flex flex-col md:items-end gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                      Amount
                    </span>
                    <span className="text-lg md:text-2xl font-black text-slate-900 flex items-center tracking-tight md:justify-end">
                      <IndianRupee className="h-4 w-4 md:h-5 md:w-5 mr-0.5 text-slate-400" />
                      {Number(p.amount || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentForDetails(p)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Details
                    </button>

                    {p.serviceId && (
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceId(p.serviceId)}
                        className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Invoice
                      </button>
                    )}

                    {(isSuccess || isRefunded) && p.serviceId && (
                      <button
                        type="button"
                        onClick={() => setSelectedReceiptId(p.serviceId)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Receipt
                      </button>
                    )}

                    {isFailed && p.vehicleId && (
                      <Link
                        to={`/service-history/${p.vehicleId}`}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry Payment
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
    </div>
  );
};

export default PaymentHistory;
