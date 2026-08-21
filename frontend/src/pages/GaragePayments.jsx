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
  RefreshCw
} from 'lucide-react';
import InvoiceModal from '../components/invoice/InvoiceModal';
import ReceiptModal from '../components/invoice/ReceiptModal';
import GarageBillingModal from '../components/garage/GarageBillingModal';

const GaragePayments = () => {
  const [invoices, setInvoices] = useState([]);
  const [revenueSummary, setRevenueSummary] = useState({
    totalRevenue: 0,
    paidInvoices: 0,
    pendingPayments: 0,
    todayRevenue: 0,
    totalServicesLogged: 0
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal States
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [billingService, setBillingService] = useState(null);

  const fetchInvoicesAndRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const [invRes, revRes] = await Promise.all([
        axios.get(`${apiBaseUrl}/api/garage/invoices/garage/all`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { page, limit: 15, search, status: statusFilter }
        }),
        axios.get(`${apiBaseUrl}/api/garage/invoices/garage/revenue/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (invRes.data?.success) {
        setInvoices(invRes.data.invoices || []);
        setTotalPages(invRes.data.totalPages || 1);
      }

      if (revRes.data?.success) {
        setRevenueSummary(revRes.data.summary);
      }
    } catch (err) {
      console.error('Error fetching garage payments & revenue:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchInvoicesAndRevenue();
  }, [fetchInvoicesAndRevenue]);

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
            Manage bill finalization, customer payments, and verified garage revenue
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Revenue</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <IndianRupee className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <IndianRupee className="h-5 w-5 text-slate-400 mr-0.5" />
            {Number(revenueSummary.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {revenueSummary.paidInvoices} verified paid bills
          </p>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today's Revenue</span>
            <span className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-teal-700 tracking-tight flex items-center">
            <IndianRupee className="h-5 w-5 text-teal-500 mr-0.5" />
            {Number(revenueSummary.todayRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1">
            Settled today
          </p>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Payments</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-700 tracking-tight flex items-center">
            <IndianRupee className="h-5 w-5 text-amber-500 mr-0.5" />
            {Number(revenueSummary.pendingPayments || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1">
            Finalized & awaiting payment
          </p>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paid Invoices</span>
            <span className="p-2 bg-slate-50 text-slate-600 rounded-xl">
              <FileCheck className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            {revenueSummary.paidInvoices} <span className="text-xs text-slate-400 font-normal">/ {revenueSummary.totalServicesLogged} total</span>
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1">
            Completed service bills
          </p>
        </div>
      </div>

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
            <option value="FINALIZED">Finalized</option>
            <option value="DRAFT">Drafts</option>
          </select>
        </div>
      </div>

      {/* Table / Invoices List */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Invoice No</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Customer & Vehicle</th>
                <th className="px-5 py-3.5">Service Type</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-2"></div>
                    Loading garage invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 font-bold">
                    No invoices found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isPaid = inv.paymentStatus === 'PAID';
                  const isFinalized = inv.invoiceStatus === 'FINALIZED';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-slate-800">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {inv.serviceDate ? new Date(inv.serviceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800">{inv.customer?.name || 'Vehicle Owner'}</div>
                        {inv.vehicle && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-bold">
                              {inv.vehicle.registrationNumber}
                            </span>
                            <span>{inv.vehicle.brand} {inv.vehicle.model}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700 max-w-[200px] truncate">
                        {inv.serviceType}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-slate-900">
                        ₹{Number(inv.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            PAID
                          </span>
                        ) : isFinalized ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black text-amber-700 bg-amber-50 border border-amber-200">
                            <Clock className="h-3 w-3 text-amber-600" />
                            UNPAID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
                            DRAFT
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedInvoiceId(inv.id)}
                            className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {!isPaid && (
                            <button
                              onClick={() => setBillingService(inv)}
                              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-[11px] font-bold transition-colors"
                            >
                              {isFinalized ? 'Edit Bill' : 'Finalize'}
                            </button>
                          )}

                          {isPaid && (
                            <button
                              onClick={() => setSelectedReceiptId(inv.id)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                            >
                              <Receipt className="h-3 w-3" />
                              Receipt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedInvoiceId && (
        <InvoiceModal
          isOpen={Boolean(selectedInvoiceId)}
          onClose={() => setSelectedInvoiceId(null)}
          serviceId={selectedInvoiceId}
          onViewReceipt={(inv) => setSelectedReceiptId(inv.id || inv._id)}
        />
      )}

      {selectedReceiptId && (
        <ReceiptModal
          isOpen={Boolean(selectedReceiptId)}
          onClose={() => setSelectedReceiptId(null)}
          serviceId={selectedReceiptId}
        />
      )}

      {billingService && (
        <GarageBillingModal
          isOpen={Boolean(billingService)}
          onClose={() => setBillingService(null)}
          service={billingService}
          onInvoiceUpdated={fetchInvoicesAndRevenue}
        />
      )}
    </div>
  );
};

export default GaragePayments;
