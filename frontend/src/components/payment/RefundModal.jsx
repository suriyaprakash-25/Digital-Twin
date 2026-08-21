import React, { useState, useEffect } from 'react';
import { 
    X, 
    RotateCcw, 
    AlertTriangle, 
    CheckCircle2, 
    IndianRupee, 
    ArrowRight,
    HelpCircle
} from 'lucide-react';
import { apiPost } from '../../utils/api';

const RefundModal = ({
    isOpen,
    onClose,
    payment,
    onRefundSuccess
}) => {
    const [refundAmount, setRefundAmount] = useState('');
    const [reason, setReason] = useState('Customer requested refund');
    const [customReason, setCustomReason] = useState('');
    const [isFullRefund, setIsFullRefund] = useState(true);
    const [confirmStep, setConfirmStep] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successResult, setSuccessResult] = useState(null);

    const originalAmount = parseFloat(payment?.amount) || 0;
    const alreadyRefunded = parseFloat(payment?.totalRefundedAmount) || 0;
    const maxRefundable = Math.max(0, originalAmount - alreadyRefunded);

    useEffect(() => {
        if (!isOpen) {
            setRefundAmount('');
            setReason('Customer requested refund');
            setCustomReason('');
            setIsFullRefund(true);
            setConfirmStep(false);
            setError('');
            setSuccessResult(null);
            setSubmitting(false);
        } else {
            setRefundAmount(maxRefundable.toString());
            setIsFullRefund(true);
        }
    }, [isOpen, maxRefundable]);

    if (!isOpen || !payment) return null;

    const handleAmountChange = (val) => {
        setRefundAmount(val);
        const numeric = parseFloat(val);
        if (numeric === maxRefundable) {
            setIsFullRefund(true);
        } else {
            setIsFullRefund(false);
        }
    };

    const handleSelectFullRefund = () => {
        setIsFullRefund(true);
        setRefundAmount(maxRefundable.toString());
    };

    const finalReason = reason === 'Other' ? (customReason || 'Customer requested refund') : reason;

    const handleSubmitRefund = async () => {
        const amt = parseFloat(refundAmount);
        if (isNaN(amt) || amt <= 0 || amt > maxRefundable) {
            setError(`Please enter a valid refund amount between ₹1 and ₹${maxRefundable}`);
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const targetId = payment.id || payment._id || payment.paymentId || payment.razorpayPaymentId;
            const res = await apiPost(`/payments/${targetId}/refund`, {
                amount: amt,
                reason: finalReason
            });

            if (res && res.success) {
                setSuccessResult(res);
                if (onRefundSuccess) {
                    onRefundSuccess(res);
                }
            } else {
                setError(res?.message || 'Failed to process refund');
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error processing refund');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div 
                className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 shadow-sm">
                            <RotateCcw className="h-5 w-5" />
                        </div>
                        <div>
                            <span className="text-[10px] sm:text-xs font-bold text-violet-700 uppercase tracking-widest block">Refund Gateway</span>
                            <h2 className="text-lg font-black text-slate-900">Initiate Payment Refund</h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
                    {successResult ? (
                        <div className="py-6 text-center space-y-4">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                                <CheckCircle2 className="h-9 w-9" />
                            </div>
                            <div>
                                <h3 className="text-xl font-extrabold text-slate-900">Refund Processed Successfully</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    The refund has been transmitted to Razorpay and will credit the customer's bank account in 5–7 working days.
                                </p>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Refund ID:</span>
                                    <span className="font-mono font-bold text-slate-900">{successResult.refund?.refundId || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Amount Refunded:</span>
                                    <span className="font-bold text-emerald-700">₹{(parseFloat(successResult.refund?.amount) || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">Updated Status:</span>
                                    <span className="font-bold text-violet-700">{successResult.payment?.status}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Summary Amounts Grid */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Original</span>
                                    <span className="text-xs sm:text-sm font-black text-slate-800">₹{originalAmount.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Refunded</span>
                                    <span className="text-xs sm:text-sm font-black text-violet-700">₹{alreadyRefunded.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                    <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-0.5">Max Refundable</span>
                                    <span className="text-xs sm:text-sm font-black text-emerald-800">₹{maxRefundable.toLocaleString('en-IN')}</span>
                                </div>
                            </div>

                            {/* Details banner */}
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs flex items-center justify-between text-slate-600">
                                <span className="font-medium">Invoice: <b className="font-mono text-slate-900">{payment.invoiceNumber || '—'}</b></span>
                                <span>Vehicle: <b className="text-slate-900">{payment.vehicleNumber || 'N/A'}</b></span>
                            </div>

                            {error && (
                                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {!confirmStep ? (
                                <>
                                    {/* Type Selection */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                                            Refund Type
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={handleSelectFullRefund}
                                                className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                                                    isFullRefund
                                                        ? 'bg-violet-50 border-violet-400 text-violet-900 shadow-sm'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span>Full Refund</span>
                                                <span className="text-[11px] font-black text-violet-700">₹{maxRefundable.toLocaleString('en-IN')}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsFullRefund(false);
                                                    setRefundAmount('');
                                                }}
                                                className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                                                    !isFullRefund
                                                        ? 'bg-violet-50 border-violet-400 text-violet-900 shadow-sm'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span>Partial Refund</span>
                                                <span className="text-[11px] font-normal text-slate-400">Custom Amount</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center text-xs">
                                            <label className="font-bold text-slate-700 uppercase tracking-wider">
                                                Refund Amount (₹)
                                            </label>
                                            <span className="text-[11px] text-slate-400 font-medium">Max: ₹{maxRefundable.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                                <IndianRupee className="h-4 w-4" />
                                            </div>
                                            <input
                                                type="number"
                                                min="1"
                                                max={maxRefundable}
                                                step="1"
                                                value={refundAmount}
                                                onChange={(e) => handleAmountChange(e.target.value)}
                                                placeholder="0.00"
                                                disabled={isFullRefund}
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all disabled:opacity-75 disabled:bg-slate-100"
                                            />
                                        </div>
                                    </div>

                                    {/* Reason */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                                            Reason for Refund
                                        </label>
                                        <select
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white"
                                        >
                                            <option value="Customer requested refund">Customer requested refund</option>
                                            <option value="Billing discrepancy / overcharge">Billing discrepancy / overcharge</option>
                                            <option value="Service cancelled before work">Service cancelled before work</option>
                                            <option value="Quality concern / parts warranty">Quality concern / parts warranty</option>
                                            <option value="Duplicate payment made">Duplicate payment made</option>
                                            <option value="Other">Other reason</option>
                                        </select>

                                        {reason === 'Other' && (
                                            <textarea
                                                rows="2"
                                                value={customReason}
                                                onChange={(e) => setCustomReason(e.target.value)}
                                                placeholder="Describe the reason for the refund..."
                                                className="w-full mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white"
                                            />
                                        )}
                                    </div>
                                </>
                            ) : (
                                /* Confirmation Screen */
                                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                                    <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
                                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                                        Please Confirm Refund
                                    </div>
                                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                        Are you sure you want to refund <strong className="text-amber-950 font-black">₹{parseFloat(refundAmount).toLocaleString('en-IN')}</strong> to the customer for invoice <strong>{payment.invoiceNumber}</strong>?
                                    </p>
                                    <div className="p-3 bg-white/80 rounded-xl border border-amber-200/80 text-xs space-y-1 text-slate-700">
                                        <div><strong>Amount:</strong> ₹{parseFloat(refundAmount).toLocaleString('en-IN')}</div>
                                        <div><strong>Reason:</strong> {finalReason}</div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
                    {successResult ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-sm"
                        >
                            Done
                        </button>
                    ) : confirmStep ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setConfirmStep(false)}
                                disabled={submitting}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all disabled:opacity-50"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitRefund}
                                disabled={submitting}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 transition-all shadow-md shadow-violet-500/20 flex items-center gap-2 disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Processing Refund...
                                    </>
                                ) : (
                                    <>
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Confirm & Process
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const amt = parseFloat(refundAmount);
                                    if (isNaN(amt) || amt <= 0 || amt > maxRefundable) {
                                        setError(`Please enter a valid refund amount between ₹1 and ₹${maxRefundable}`);
                                        return;
                                    }
                                    setError('');
                                    setConfirmStep(true);
                                }}
                                disabled={maxRefundable <= 0}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 transition-all shadow-md shadow-violet-500/20 flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <span>Continue</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RefundModal;
