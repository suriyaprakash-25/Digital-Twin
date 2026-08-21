import React, { useState, useEffect } from 'react';
import { 
    CreditCard, 
    Search, 
    Filter, 
    RefreshCw, 
    IndianRupee, 
    CheckCircle2, 
    XCircle, 
    RotateCcw, 
    Clock, 
    ChevronLeft, 
    ChevronRight, 
    Eye, 
    FileText, 
    Receipt, 
    ShieldCheck, 
    Building2,
    AlertCircle
} from 'lucide-react';
import { apiGet } from '../../utils/api';
import PaymentDetailsModal from '../../components/payment/PaymentDetailsModal';
import RefundModal from '../../components/payment/RefundModal';
import InvoiceModal from '../../components/invoice/InvoiceModal';
import ReceiptModal from '../../components/invoice/ReceiptModal';

const AdminPayments = () => {
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Modals
    const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState(null);
    const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
    const [selectedReceiptId, setSelectedReceiptId] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [summaryRes, listRes] = await Promise.allSettled([
                apiGet('/admin/payments/summary'),
                apiGet(`/admin/payments/all?page=${currentPage}&limit=15&status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`)
            ]);

            if (summaryRes.status === 'fulfilled' && summaryRes.value?.success) {
                setSummary(summaryRes.value.summary);
            }
            if (listRes.status === 'fulfilled' && listRes.value?.success) {
                setPayments(listRes.value.payments || []);
                setTotalPages(listRes.value.totalPages || 1);
                setTotalCount(listRes.value.totalCount || 0);
            }
        } catch (err) {
            console.error('Error fetching admin payments:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentPage, statusFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        fetchData();
    };

    const getStatusBadge = (status, totalRefunded = 0) => {
        if (status === 'CAPTURED' || status === 'PAID') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> Paid
                </span>
            );
        } else if (status === 'REFUNDED') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-violet-50 text-violet-700 border border-violet-200">
                    <RotateCcw className="h-3 w-3" /> Refunded
                </span>
            );
        } else if (status === 'PARTIALLY_REFUNDED') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-purple-50 text-purple-700 border border-purple-200">
                    <RotateCcw className="h-3 w-3" /> Partial Refund
                </span>
            );
        } else if (status === 'FAILED') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                    <XCircle className="h-3 w-3" /> Failed
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="h-3 w-3" /> Pending
            </span>
        );
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="h-5 w-5 text-teal-600" />
                        <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Platform Admin</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Payment Intelligence & Administration</h1>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                        Global transaction monitor, gateway reconciliation, and customer refund processing.
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="self-start sm:self-auto px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-all flex items-center gap-2"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Data
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Volume</span>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 flex items-center">
                        <IndianRupee className="h-5 w-5 text-slate-400 mr-0.5" />
                        {(summary?.totalVolume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium mt-1 block">{summary?.totalTransactions || 0} Total Orders</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">Captured Payments</span>
                    <div className="text-xl sm:text-2xl font-black text-emerald-800 flex items-center">
                        <IndianRupee className="h-5 w-5 text-emerald-500 mr-0.5" />
                        {(summary?.successfulVolume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <span className="text-[11px] text-emerald-600 font-bold mt-1 block">{summary?.successfulCount || 0} Successful</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
                    <span className="text-[10px] font-bold text-violet-600 uppercase tracking-widest block mb-1">Total Refunded</span>
                    <div className="text-xl sm:text-2xl font-black text-violet-800 flex items-center">
                        <IndianRupee className="h-5 w-5 text-violet-500 mr-0.5" />
                        {(summary?.totalRefundedAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <span className="text-[11px] text-violet-600 font-bold mt-1 block">{summary?.refundedCount || 0} Refunded</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block mb-1">Pending Amount</span>
                    <div className="text-xl sm:text-2xl font-black text-amber-800 flex items-center">
                        <IndianRupee className="h-5 w-5 text-amber-500 mr-0.5" />
                        {(summary?.pendingAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <span className="text-[11px] text-amber-600 font-bold mt-1 block">{summary?.pendingCount || 0} Invoices</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest block mb-1">Failed Payments</span>
                    <div className="text-xl sm:text-2xl font-black text-rose-800 flex items-center">
                        {summary?.failedCount || 0}
                    </div>
                    <span className="text-[11px] text-rose-600 font-medium mt-1 block">Declined Transactions</span>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by invoice number, payment ID, order ID, garage or vehicle..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                    />
                </form>

                <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                    {['ALL', 'PAID', 'REFUNDED', 'FAILED', 'PENDING'].map((status) => (
                        <button
                            key={status}
                            type="button"
                            onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                statusFilter === status
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                            }`}
                        >
                            {status === 'ALL' ? 'All Records' : status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                                <th className="p-4 pl-6">Invoice & Gateway ID</th>
                                <th className="p-4">Garage & Service</th>
                                <th className="p-4">Vehicle</th>
                                <th className="p-4">Amount</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Date</th>
                                <th className="p-4 pr-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="py-16 text-center text-slate-400">
                                        <div className="animate-spin h-7 w-7 border-3 border-teal-500 border-t-transparent rounded-full mx-auto mb-2" />
                                        <p className="text-xs font-bold uppercase tracking-wider">Loading transactions...</p>
                                    </td>
                                </tr>
                            ) : payments.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-16 text-center text-slate-400">
                                        <CreditCard className="h-10 w-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                                        <p className="text-sm font-bold text-slate-700">No payment transactions found</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search criteria or status filter.</p>
                                    </td>
                                </tr>
                            ) : (
                                payments.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-4 pl-6">
                                            <div className="font-mono font-bold text-slate-900">{p.invoiceNumber || '—'}</div>
                                            <div className="font-mono text-[10px] text-slate-400 truncate max-w-[130px]">{p.paymentId || p.orderId}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate max-w-[160px]">
                                                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                {p.garageName}
                                            </div>
                                            <div className="text-[11px] text-slate-500 truncate max-w-[160px]">{p.serviceType}</div>
                                        </td>
                                        <td className="p-4 font-mono font-bold text-slate-800">
                                            {p.vehicleNumber}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-black text-slate-900 flex items-center">
                                                <IndianRupee className="h-3.5 w-3.5 text-slate-400 mr-0.5" />
                                                {(parseFloat(p.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </div>
                                            <div className="text-[10px] text-slate-400">{p.paymentMethod || 'Online'}</div>
                                        </td>
                                        <td className="p-4">
                                            {getStatusBadge(p.status, p.totalRefundedAmount)}
                                        </td>
                                        <td className="p-4 text-slate-500 text-[11px] whitespace-nowrap">
                                            {p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                        </td>
                                        <td className="p-4 pr-6 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedPaymentForDetails(p)}
                                                    className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                                                    title="View Full Audit Details"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                {p.serviceId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedInvoiceId(p.serviceId)}
                                                        className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                                                        title="View Invoice"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {(p.status === 'CAPTURED' || p.status === 'PAID') && (
                                                    <>
                                                        {p.serviceId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedReceiptId(p.serviceId)}
                                                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                title="View Receipt"
                                                            >
                                                                <Receipt className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedPaymentForRefund(p)}
                                                            className="p-1.5 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors"
                                                            title="Process Refund"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                        <span>Showing Page {currentPage} of {totalPages} ({totalCount} Records)</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Payment Audit Details Modal */}
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
                    onRefundSuccess={() => fetchData()}
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

export default AdminPayments;
