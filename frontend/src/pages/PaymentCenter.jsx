import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  CreditCard,
  Search,
  Filter,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  Printer,
  Download,
  Car,
  ChevronRight,
  Shield,
  Eye,
  Calendar,
  X,
  Loader2
} from 'lucide-react';
import RefundTrackingModal from '../components/payments/RefundTrackingModal';
import { API_BASE_URL } from '../utils/config';
import { loadRazorpayScript } from '../utils/loadRazorpay';
import { useToast } from '../context/ToastContext';

export default function PaymentCenter() {
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [vehicleFilter, setVehicleFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedRefundPayment, setSelectedRefundPayment] = useState(null);
  const [payingPaymentId, setPayingPaymentId] = useState(null);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [sumRes, histRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/payments/customer/financial-summary`, { headers }),
        fetch(`${API_BASE_URL}/api/payments/history`, { headers })
      ]);

      const sumData = await sumRes.json();
      const histData = await histRes.json();

      if (sumData.success) {
        setSummary(sumData.summary);
      }
      if (histData.success) {
        setPayments(histData.payments || []);
      }
    } catch (err) {
      console.error('Error loading customer financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async (paymentItem) => {
    if (payingPaymentId) return;
    setPayingPaymentId(paymentItem.id);

    try {
      // 1. Ensure Razorpay SDK is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        showToast('Failed to load payment gateway script. Please check your internet connection.', 'error');
        setPayingPaymentId(null);
        return;
      }

      const token = localStorage.getItem('token');
      const userRaw = localStorage.getItem('user');
      const user = userRaw ? JSON.parse(userRaw) : {};

      // 2. Create server-side Razorpay Order
      const targetServiceId = paymentItem.serviceId || paymentItem.id;
      const res = await axios.post(
        `${API_BASE_URL}/api/payments/create-order`,
        { serviceId: targetServiceId, invoiceId: paymentItem.invoiceNumber || paymentItem.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.data?.success || !res.data?.order) {
        throw new Error(res.data?.message || 'Failed to initialize payment order');
      }

      const orderData = res.data.order;
      const razorpayKey = orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TSSWBNcFmDPpRK';

      // 3. Configure Razorpay Standard Checkout
      const options = {
        key: razorpayKey,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'DrivePortz Mobility',
        description: `Invoice ${orderData.invoiceNumber || paymentItem.invoiceNumber || 'Payment'} - ${paymentItem.serviceType || 'Automotive Service'}`,
        image: '/logo-removebg-preview.png',
        order_id: orderData.id,
        prefill: {
          name: user.name || '',
          email: user.email || '',
          contact: user.phone || ''
        },
        theme: {
          color: '#0d9488'
        },
        modal: {
          ondismiss: () => {
            setPayingPaymentId(null);
          }
        },
        handler: async (response) => {
          try {
            // 4. Send signature to backend for verification
            const verifyRes = await axios.post(
              `${API_BASE_URL}/api/payments/verify`,
              {
                paymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                serviceId: targetServiceId
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (verifyRes.data?.success) {
              showToast('Payment successful! Your invoice has been settled.', 'success');
              if (selectedInvoice) setSelectedInvoice(null);
              await fetchFinancialData();
            } else {
              showToast('Payment verification failed. Please contact support.', 'error');
            }
          } catch (verifyErr) {
            console.error('Payment verification error:', verifyErr);
            showToast(verifyErr.response?.data?.message || 'Payment verification failed', 'error');
          } finally {
            setPayingPaymentId(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        console.error('Razorpay payment failed:', response.error);
        showToast(`Payment failed: ${response.error?.description || 'Transaction declined'}`, 'error');
        setPayingPaymentId(null);
      });

      rzp.open();
    } catch (err) {
      console.error('Error starting payment:', err);
      showToast(err.response?.data?.message || err.message || 'Unable to initialize payment', 'error');
      setPayingPaymentId(null);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, []);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Search
      const matchesSearch =
        !search.trim() ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(search.toLowerCase())) ||
        (p.garageName && p.garageName.toLowerCase().includes(search.toLowerCase())) ||
        (p.serviceType && p.serviceType.toLowerCase().includes(search.toLowerCase())) ||
        (p.vehicleNumber && p.vehicleNumber.toLowerCase().includes(search.toLowerCase())) ||
        (p.paymentId && p.paymentId.toLowerCase().includes(search.toLowerCase()));

      // Status
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'CAPTURED' && (p.status === 'CAPTURED' || p.status === 'PAID')) ||
        (statusFilter === 'PENDING' && (p.status === 'PENDING' || p.status === 'CREATED')) ||
        (statusFilter === 'REFUNDED' && (p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED')) ||
        p.status === statusFilter;

      // Vehicle
      const matchesVehicle = vehicleFilter === 'ALL' || p.vehicleNumber === vehicleFilter;

      return matchesSearch && matchesStatus && matchesVehicle;
    });
  }, [payments, search, statusFilter, vehicleFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CAPTURED':
      case 'PAID':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Paid</span>;
      case 'PENDING':
      case 'CREATED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3 text-amber-600" /> Pending</span>;
      case 'REFUNDED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200"><RefreshCw className="w-3 h-3 text-sky-600" /> Refunded</span>;
      case 'PARTIALLY_REFUNDED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200"><RefreshCw className="w-3 h-3 text-sky-600" /> Partial Refund</span>;
      case 'FAILED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle className="w-3 h-3 text-rose-600" /> Failed</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-600 shadow-sm">
                <CreditCard className="w-6 h-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Payment Center</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Manage your service payments, tax invoices, and track refund lifecycles in real-time.
            </p>
          </div>
          <button
            onClick={fetchFinancialData}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-teal-600" /> Refresh
          </button>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Paid</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">
                  ₹{Number(summary?.totalPaidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">{summary?.statusDistribution?.CAPTURED || 0} Successful Transactions</p>
          </div>

          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Payments</span>
                <h3 className="text-2xl font-black text-amber-600 mt-1">
                  ₹{Number(summary?.pendingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">{summary?.statusDistribution?.PENDING || 0} Invoices Awaiting Settlement</p>
          </div>

          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Refunds Received</span>
                <h3 className="text-2xl font-black text-sky-600 mt-1">
                  ₹{Number(summary?.refundAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-2 bg-sky-50 border border-sky-200 rounded-xl text-sky-600">
                <RefreshCw className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">{(summary?.statusDistribution?.REFUNDED || 0) + (summary?.statusDistribution?.PARTIALLY_REFUNDED || 0)} Credited Adjustments</p>
          </div>

          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tax Invoices</span>
                <h3 className="text-2xl font-black text-teal-600 mt-1">
                  {summary?.invoicesCount || 0}
                </h3>
              </div>
              <div className="p-2 bg-teal-50 border border-teal-200 rounded-xl text-teal-600">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">Across {summary?.vehicles?.length || 0} Registered Vehicles</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice, garage, service..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs">
              {['ALL', 'CAPTURED', 'PENDING', 'REFUNDED'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition ${
                    statusFilter === st ? 'bg-teal-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'CAPTURED' ? 'Paid' : st === 'ALL' ? 'All' : st === 'REFUNDED' ? 'Refunds' : 'Pending'}
                </button>
              ))}
            </div>

            {/* Vehicle Filter */}
            {summary?.vehicles && summary.vehicles.length > 0 && (
              <select
                value={vehicleFilter}
                onChange={e => setVehicleFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-teal-500"
              >
                <option value="ALL">All Vehicles</option>
                {summary.vehicles.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Invoice / Date</th>
                  <th className="px-6 py-4 font-semibold">Service & Garage</th>
                  <th className="px-6 py-4 font-semibold">Vehicle</th>
                  <th className="px-6 py-4 font-semibold">Amount</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                      Loading payment records...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No payment transactions found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 font-mono">{p.invoiceNumber || '—'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {new Date(p.date || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{p.serviceType || 'Automotive Service'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{p.garageName || 'Authorized Center'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                          <Car className="w-3.5 h-3.5 text-teal-600" />
                          {p.vehicleNumber || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 font-mono">
                        ₹{Number(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        {p.totalRefundedAmount > 0 && (
                          <div className="text-[11px] font-normal text-sky-600">
                            -₹{Number(p.totalRefundedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} refunded
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(p.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Invoice Detail / View Receipt */}
                          <button
                            onClick={() => setSelectedInvoice(p)}
                            className="p-1.5 bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 rounded-lg transition"
                            title="View Invoice & Tax Breakdown"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Track Refund if applicable */}
                          {(p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED' || (p.refunds && p.refunds.length > 0)) && (
                            <button
                              onClick={() => setSelectedRefundPayment(p)}
                              className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-medium transition flex items-center gap-1"
                              title="Track Refund Lifecycle"
                            >
                              <RefreshCw className="w-3 h-3 text-sky-600" /> Track Refund
                            </button>
                          )}

                          {/* Pay Now for Pending */}
                          {(p.status === 'PENDING' || p.status === 'CREATED') && (
                            <button
                              onClick={() => handlePayNow(p)}
                              disabled={payingPaymentId === p.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {payingPaymentId === p.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Opening...</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Pay Now</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice & Tax Breakdown Modal */}
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden print:m-0 print:border-none print:shadow-none">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 print:hidden">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-teal-50 border border-teal-200 rounded-xl text-teal-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Tax Invoice</h3>
                    <p className="text-xs text-slate-500 font-mono">{selectedInvoice.invoiceNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintInvoice}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {/* Header Metadata */}
                <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                  <div>
                    <h4 className="text-lg font-bold text-teal-600">DrivePortz Mobility Twin</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Automotive Service Partner Network</p>
                    <p className="text-xs text-slate-500">GSTIN: 29AAACD1234F1Z5</p>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-slate-500">Invoice Date:</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{new Date(selectedInvoice.date || Date.now()).toLocaleDateString('en-IN')}</p>
                    <span className="text-slate-500 mt-2 block">Payment Status:</span>
                    <div className="mt-0.5">{getStatusBadge(selectedInvoice.status)}</div>
                  </div>
                </div>

                {/* Service & Vehicle Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider font-semibold">Billed To</span>
                    <p className="text-slate-900 font-medium mt-1">Valued Customer</p>
                    <p className="text-slate-500">Vehicle: <span className="font-mono text-teal-700 font-bold">{selectedInvoice.vehicleNumber || '—'}</span></p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider font-semibold">Service Provider</span>
                    <p className="text-slate-900 font-medium mt-1">{selectedInvoice.garageName || 'Authorized Workshop'}</p>
                    <p className="text-slate-500">Payment Ref: <span className="font-mono text-slate-700">{selectedInvoice.paymentId || selectedInvoice.orderId || '—'}</span></p>
                  </div>
                </div>

                {/* Line Items & Tax Computation */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold">
                      <tr>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Taxable Amount</th>
                        <th className="p-3 text-right">GST (18%)</th>
                        <th className="p-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-3 text-slate-800">
                          {selectedInvoice.serviceType || 'Standard Automotive Service & Inspection'}
                        </td>
                        <td className="p-3 text-right text-slate-700 font-mono">
                          ₹{(Number(selectedInvoice.amount || 0) / 1.18).toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-slate-500 font-mono">
                          ₹{(Number(selectedInvoice.amount || 0) - (Number(selectedInvoice.amount || 0) / 1.18)).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900 font-mono">
                          ₹{Number(selectedInvoice.amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Tax Breakdown Subtable */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Taxable Base Value:</span>
                    <span className="font-mono text-slate-700">₹{(Number(selectedInvoice.amount || 0) / 1.18).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>CGST (9.0%):</span>
                    <span className="font-mono text-slate-700">₹{((Number(selectedInvoice.amount || 0) - (Number(selectedInvoice.amount || 0) / 1.18)) / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>SGST (9.0%):</span>
                    <span className="font-mono text-slate-700">₹{((Number(selectedInvoice.amount || 0) - (Number(selectedInvoice.amount || 0) / 1.18)) / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold pt-2 border-t border-slate-200 text-sm">
                    <span>Grand Total:</span>
                    <span className="font-mono text-teal-600 font-black">₹{Number(selectedInvoice.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70 print:hidden">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
                >
                  Close
                </button>
                {(selectedInvoice.status === 'PENDING' || selectedInvoice.status === 'CREATED') && (
                  <button
                    onClick={() => handlePayNow(selectedInvoice)}
                    disabled={payingPaymentId === selectedInvoice.id}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-sm font-bold transition shadow-sm disabled:opacity-60"
                  >
                    {payingPaymentId === selectedInvoice.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Opening Checkout...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>Pay ₹{Number(selectedInvoice.amount || 0).toLocaleString('en-IN')}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Refund Tracking Modal */}
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
