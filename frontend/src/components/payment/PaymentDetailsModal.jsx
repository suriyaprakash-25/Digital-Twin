import React, { useState, useEffect } from 'react';
import { 
    X, 
    CheckCircle2, 
    XCircle, 
    RotateCcw, 
    Clock, 
    CreditCard, 
    Building2, 
    Car, 
    Wrench, 
    Receipt, 
    FileText, 
    IndianRupee,
    ExternalLink,
    AlertCircle
} from 'lucide-react';
import { apiGet } from '../../utils/api';

const PaymentDetailsModal = ({
    isOpen,
    onClose,
    paymentId,
    paymentData,
    onViewInvoice,
    onViewReceipt
}) => {
    const [details, setDetails] = useState(paymentData || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        if (paymentData) {
            setDetails(paymentData);
        } else if (paymentId) {
            fetchPaymentDetails(paymentId);
        }
    }, [isOpen, paymentId, paymentData]);

    const fetchPaymentDetails = async (id) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiGet(`/payments/details/${id}`);
            if (res && res.success && res.payment) {
                setDetails(res.payment);
            } else {
                setError(res?.message || 'Failed to load payment details');
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error fetching payment audit details');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isPaid = details?.status === 'CAPTURED' || details?.status === 'PAID';
    const isFailed = details?.status === 'FAILED';
    const isRefunded = details?.status === 'REFUNDED' || details?.status === 'PARTIALLY_REFUNDED';
    const isPartiallyRefunded = details?.status === 'PARTIALLY_REFUNDED';

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div 
                className="bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <span className="text-[10px] sm:text-xs font-bold text-teal-600 uppercase tracking-widest block mb-0.5">Transaction Audit</span>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                            Payment Details
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
                    {loading ? (
                        <div className="py-12 text-center text-slate-400">
                            <div className="animate-spin h-8 w-8 border-3 border-teal-500 border-t-transparent rounded-full mx-auto mb-3" />
                            <p className="text-xs font-bold uppercase tracking-wider">Loading transaction details...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    ) : details ? (
                        <>
                            {/* Status Banner */}
                            {isRefunded ? (
                                <div className="p-4 rounded-2xl bg-violet-50 border border-violet-200 flex items-center gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                                        <RotateCcw className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-extrabold text-violet-900 text-sm">
                                            {isPartiallyRefunded ? 'Partially Refunded' : 'Payment Refunded'}
                                        </h4>
                                        <p className="text-xs text-violet-700 font-medium">
                                            ₹{details.totalRefundedAmount} refunded back to customer via original payment method
                                        </p>
                                    </div>
                                </div>
                            ) : isPaid ? (
                                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-extrabold text-emerald-900 text-sm">Payment Successful</h4>
                                        <p className="text-xs text-emerald-700 font-medium">Verified and captured through Razorpay Standard Checkout</p>
                                    </div>
                                </div>
                            ) : isFailed ? (
                                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                                        <XCircle className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-extrabold text-rose-900 text-sm">Payment Failed</h4>
                                        <p className="text-xs text-rose-700 font-medium">{details.failureReason || 'Transaction was declined by customer bank or gateway'}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-extrabold text-amber-900 text-sm">Payment Pending</h4>
                                        <p className="text-xs text-amber-700 font-medium">Order created and awaiting customer payment</p>
                                    </div>
                                </div>
                            )}

                            {/* Main Amount Card */}
                            <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-lg">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Total Transaction Amount</span>
                                    <div className="text-2xl sm:text-3xl font-black flex items-center tracking-tight">
                                        <IndianRupee className="h-6 w-6 sm:h-7 sm:w-7 mr-0.5 text-teal-400" />
                                        {(parseFloat(details.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Method</span>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-xl text-xs font-bold text-teal-300">
                                        <CreditCard className="h-3.5 w-3.5" />
                                        {details.paymentMethod || 'Razorpay / Online'}
                                    </span>
                                </div>
                            </div>

                            {/* Key Identifiers */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Invoice Number</span>
                                    <span className="font-mono text-xs font-black text-slate-800 break-all">{details.invoiceNumber || '—'}</span>
                                </div>
                                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Gateway Payment ID</span>
                                    <span className="font-mono text-xs font-black text-slate-800 break-all">{details.paymentId || details.razorpayPaymentId || '—'}</span>
                                </div>
                                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Gateway Order ID</span>
                                    <span className="font-mono text-xs font-black text-slate-800 break-all">{details.orderId || details.razorpayOrderId || '—'}</span>
                                </div>
                                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Payment Date</span>
                                    <span className="text-xs font-bold text-slate-800">
                                        {details.paidAt || details.date ? new Date(details.paidAt || details.date).toLocaleString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        }) : 'Pending'}
                                    </span>
                                </div>
                            </div>

                            {/* Service / Vehicle / Garage Details */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                                        <Wrench className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Service</span>
                                        <p className="text-xs font-bold text-slate-800 truncate">{details.serviceType || 'General Maintenance'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                                        <Car className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle</span>
                                        <p className="text-xs font-bold text-slate-800 truncate">{details.vehicleNumber || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                                        <Building2 className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Garage</span>
                                        <p className="text-xs font-bold text-slate-800 truncate">{details.garageName || 'Authorized Garage'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Refund Records (if any) */}
                            {details.refunds && details.refunds.length > 0 && (
                                <div className="space-y-2 pt-2">
                                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <RotateCcw className="h-3.5 w-3.5 text-violet-600" />
                                        Refund Audit Trail ({details.refunds.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {details.refunds.map((ref, idx) => (
                                            <div key={idx} className="p-3 bg-violet-50/60 border border-violet-100 rounded-xl text-xs space-y-1">
                                                <div className="flex items-center justify-between font-bold text-slate-800">
                                                    <span className="font-mono text-violet-800">{ref.refundId || `REF-${idx + 1}`}</span>
                                                    <span className="text-violet-900 font-black">₹{(parseFloat(ref.amount) || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                                    <span>Reason: {ref.reason || 'Requested by garage/customer'}</span>
                                                    <span>{ref.createdAt ? new Date(ref.createdAt).toLocaleDateString('en-IN') : 'Processed'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>

                {/* Footer Actions */}
                <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
                    {details?.serviceId && onViewInvoice && (
                        <button
                            type="button"
                            onClick={() => { onClose(); onViewInvoice(details.serviceId); }}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-all flex items-center gap-1.5"
                        >
                            <FileText className="h-3.5 w-3.5" />
                            View Invoice
                        </button>
                    )}
                    {isPaid && details?.serviceId && onViewReceipt && (
                        <button
                            type="button"
                            onClick={() => { onClose(); onViewReceipt(details.serviceId); }}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all flex items-center gap-1.5"
                        >
                            <Receipt className="h-3.5 w-3.5" />
                            View Receipt
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentDetailsModal;
