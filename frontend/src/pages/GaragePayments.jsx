import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  CreditCard,
  IndianRupee,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  ArrowLeft,
  Building,
  Car,
  User,
  FileText,
  FileCheck,
  Receipt,
  Eye,
  TrendingUp,
  RotateCcw,
  RefreshCw,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import InvoiceModal from '../components/invoice/InvoiceModal';
import ReceiptModal from '../components/invoice/ReceiptModal';
import GarageBillingModal from '../components/garage/GarageBillingModal';
import PaymentDetailsModal from '../components/payment/PaymentDetailsModal';
import RefundModal from '../components/payment/RefundModal';

const GaragePayments = () => {
  const [invoices, setInvoices] = useState([]);
  const [revenueSummary, setRevenueSummary] = useState({
    totalRevenue: 0,
    paidInvoices: 0,
    pendingPayments: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    refundedAmount: 0,
    failedPayments: 0,
    totalServicesLogged: 0
  });
  const [analyticsData, setAnalyticsData] = useState([]);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('7days');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal States
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState(null);
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState(null);
  const [billingService, setBillingService] = useState(null);

  const fetchInvoicesAndRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const [invRes, revRes, anaRes] = await Promise.allSettled([
        axios.get(`${apiBaseUrl}/api/garage/invoices/garage/all`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { page, limit: 15, search, status: statusFilter }
        }),
        axios.get(`${apiBaseUrl}/api/garage/invoices/garage/revenue/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${apiBaseUrl}/api/garage/invoices/garage/payments/analytics?period=${analyticsPeriod}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (invRes.status === 'fulfilled' && invRes.value.data?.success) {
        setInvoices(invRes.value.data.invoices || []);
        setTotalPages(invRes.value.data.totalPages || 1);
      }

      if (revRes.status === 'fulfilled' && revRes.value.data?.success) {
        setRevenueSummary(revRes.value.data.summary);
      }

      if (anaRes.status === 'fulfilled' && anaRes.value.data?.success) {
        setAnalyticsData(anaRes.value.data.trends || []);
      }
    } catch (err) {
      console.error('Error fetching garage payments & revenue:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, analyticsPeriod]);

  useEffect(() => {
    fetchInvoicesAndRevenue();
  }, [fetchInvoicesAndRevenue]);

  const maxTrendRevenue = Math.max(...analyticsData.map(d => d.revenue), 1);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/garage-dashboard"
            className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-teal-600 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Garage Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Payments & Invoices
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
            Manage bill finalization, customer payments, verified garage revenue, and customer refunds
          </p>
        </div>

        <button
          onClick={fetchInvoicesAndRevenue}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Revenue</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-400 mr-0.5" />
            {Number(revenueSummary.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-0.5">
            <CheckCircle2 className="h-3 w-3" />
            {revenueSummary.paidInvoices} Paid Bills
          </p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block mb-1">Today's Revenue</span>
          <div className="text-xl sm:text-2xl font-black text-teal-700 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-teal-500 mr-0.5" />
            {Number(revenueSummary.todayRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Settled today</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">This Month</span>
          <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-400 mr-0.5" />
            {Number(revenueSummary.monthRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Current Month</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block mb-1">Pending Amount</span>
          <div className="text-xl sm:text-2xl font-black text-amber-700 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-amber-500 mr-0.5" />
            {Number(revenueSummary.pendingPayments || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-amber-600 mt-1">Awaiting Payment</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 block mb-1">Total Refunded</span>
          <div className="text-xl sm:text-2xl font-black text-violet-800 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-violet-500 mr-0.5" />
            {Number(revenueSummary.refundedAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-violet-600 mt-1">Refunded to Customers</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Paid Invoices</span>
          <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
            {revenueSummary.paidInvoices} <span className="text-xs text-slate-400 font-normal">/ {revenueSummary.totalServicesLogged}</span>
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Completed Services</p>
        </div>
      </div>

      {/* Revenue Trends Chart Section */}
      {analyticsData.length > 0 && (
        <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-extrabold text-slate-900">Revenue Trends</h3>
            </div>
            <div className="flex items-center gap-1.5">
              {['7days', '30days'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAnalyticsPeriod(p)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    analyticsPeriod === p
                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {p === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-36 flex items-end gap-2 pt-4 border-t border-slate-50">
            {analyticsData.map((d, i) => {
              const heightPercent = Math.max(8, (d.revenue / maxTrendRevenue) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                    ₹{d.revenue.toLocaleString('en-IN')} ({d.count} sales)
                  </div>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full bg-teal-500 hover:bg-teal-600 rounded-t-lg transition-all"
                  />
                  <span className="text-[9px] font-bold text-slate-400 truncate max-w-full">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls: Search & Filters */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number, customer, vehicle..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PAID">Paid Only</option>
            <option value="UNPAID">Unpaid Only</option>
            <option value="FINALIZED">Finalized Only</option>
            <option value="DRAFT">Draft Only</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 px-4">
            <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Invoices Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No bills match your active filter. Services completed by your garage will appear here for billing & payment tracking.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 pl-6">Invoice #</th>
                  <th className="py-3.5 px-4">Vehicle & Customer</th>
                  <th className="py-3.5 px-4">Service</th>
                  <th className="py-3.5 px-4">Bill Amount</th>
                  <th className="py-3.5 px-4">Payment Status</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {invoices.map((inv) => {
                  const isPaid = inv.paymentStatus === 'PAID';
                  const isDraft = inv.invoiceStatus === 'DRAFT';
                  const isFinalized = inv.invoiceStatus === 'FINALIZED';
                  const isRefunded = inv.paymentStatus === 'REFUNDED' || inv.paymentStatus === 'PARTIALLY_REFUNDED';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 pl-6 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber ? (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            {inv.invoiceNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Draft Bill</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <Car className="h-3.5 w-3.5 text-slate-400" />
                          {inv.vehicleNumber || 'N/A'}
                        </div>
                        {inv.customerName && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            {inv.customerName}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800">{inv.serviceType}</div>
                        <div className="text-[11px] text-slate-400">{inv.serviceCategory}</div>
                      </td>
                      <td className="py-4 px-4 font-black text-slate-900">
                        ₹{(parseFloat(inv.totalAmount || inv.totalCost) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4">
                        {isRefunded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-violet-50 text-violet-700 border border-violet-200">
                            <RotateCcw className="h-3 w-3" /> REFUNDED
                          </span>
                        ) : isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> PAID
                          </span>
                        ) : isFinalized ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="h-3 w-3" /> UNPAID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                            DRAFT
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-400 text-[11px]">
                        {inv.serviceDate ? new Date(inv.serviceDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-4 px-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentForDetails(inv)}
                            className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                            title="View Audit Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceId(inv.id || inv._id)}
                            className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-all"
                          >
                            Invoice
                          </button>

                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => setBillingService(inv)}
                              className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all"
                            >
                              {isDraft ? 'Create Bill' : 'Edit Bill'}
                            </button>
                          )}

                          {isPaid && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedReceiptId(inv.id || inv._id)}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all"
                              >
                                Receipt
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPaymentForRefund(inv)}
                                className="p-1.5 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors"
                                title="Issue Customer Refund"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tax Invoice Modal */}
      {selectedInvoiceId && (
        <InvoiceModal
          isOpen={Boolean(selectedInvoiceId)}
          onClose={() => setSelectedInvoiceId(null)}
          serviceId={selectedInvoiceId}
          onViewReceipt={(inv) => setSelectedReceiptId(inv.id || inv._id)}
        />
      )}

      {/* Payment Receipt Modal */}
      {selectedReceiptId && (
        <ReceiptModal
          isOpen={Boolean(selectedReceiptId)}
          onClose={() => setSelectedReceiptId(null)}
          serviceId={selectedReceiptId}
        />
      )}

      {/* Audit Details Modal */}
      {selectedPaymentForDetails && (
        <PaymentDetailsModal
          isOpen={Boolean(selectedPaymentForDetails)}
          onClose={() => setSelectedPaymentForDetails(null)}
          paymentData={selectedPaymentForDetails}
          onViewInvoice={(sId) => setSelectedInvoiceId(sId)}
          onViewReceipt={(sId) => setSelectedReceiptId(sId)}
        />
      )}

      {/* Refund Modal */}
      {selectedPaymentForRefund && (
        <RefundModal
          isOpen={Boolean(selectedPaymentForRefund)}
          onClose={() => setSelectedPaymentForRefund(null)}
          payment={selectedPaymentForRefund}
          onRefundSuccess={() => fetchInvoicesAndRevenue()}
        />
      )}

      {/* Garage Bill Editor & Finalizer */}
      {billingService && (
        <GarageBillingModal
          isOpen={Boolean(billingService)}
          onClose={() => setBillingService(null)}
          service={billingService}
          onSuccess={() => {
            setBillingService(null);
            fetchInvoicesAndRevenue();
          }}
        />
      )}
    </div>
  );
};

export default GaragePayments;
