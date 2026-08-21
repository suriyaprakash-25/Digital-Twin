import React from 'react';
import { X, CheckCircle2, Clock, ArrowRight, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

const REFUND_STAGES = [
  { key: 'REFUND_REQUESTED', label: 'Refund Requested', desc: 'Request submitted and under review' },
  { key: 'REFUND_PENDING', label: 'Refund Pending', desc: 'Approved and dispatched to banking gateway' },
  { key: 'REFUND_PROCESSED', label: 'Processing at Bank', desc: 'Acquiring bank is routing funds' },
  { key: 'REFUND_COMPLETED', label: 'Refund Completed', desc: 'Credited to original payment source' }
];

export default function RefundTrackingModal({ payment, onClose }) {
  if (!payment) return null;

  const originalAmount = Number(payment.amount || 0);
  const refundedAmount = Number(payment.totalRefundedAmount || (payment.refunds || []).reduce((sum, r) => sum + Number(r.amount || 0), 0));
  const remainingAmount = Math.max(0, originalAmount - refundedAmount);
  const primaryRefund = (payment.refunds && payment.refunds[0]) || {};

  // Determine active stage
  let activeStageIndex = 0;
  if (payment.status === 'REFUNDED') {
    activeStageIndex = 3;
  } else if (payment.status === 'PARTIALLY_REFUNDED') {
    activeStageIndex = 3;
  } else if (primaryRefund.status === 'PROCESSED' || primaryRefund.status === 'COMPLETED') {
    activeStageIndex = 3;
  } else if (primaryRefund.status === 'PENDING') {
    activeStageIndex = 1;
  } else {
    activeStageIndex = 2;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Refund Tracker</h3>
              <p className="text-xs text-slate-400">Invoice {payment.invoiceNumber || '—'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Financial Breakdown Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-800/60 border border-slate-700/50 rounded-xl">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Original Total</span>
              <p className="text-base font-bold text-white mt-1">₹{originalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3.5 bg-sky-500/10 border border-sky-500/20 rounded-xl">
              <span className="text-[11px] font-medium text-sky-300 uppercase tracking-wider">Refunded</span>
              <p className="text-base font-bold text-sky-400 mt-1">₹{refundedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="p-3.5 bg-slate-800/60 border border-slate-700/50 rounded-xl">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Remaining</span>
              <p className="text-base font-bold text-slate-300 mt-1">₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Refund Details */}
          <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Refund ID:</span>
              <span className="font-mono text-slate-200">{primaryRefund.refundId || primaryRefund.id || payment.razorpayRefundId || 'RFD_' + (payment.id || '').substring(0, 8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Payment ID:</span>
              <span className="font-mono text-slate-200">{payment.paymentId || payment.razorpayPaymentId || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Initiated On:</span>
              <span className="text-slate-200">{new Date(primaryRefund.createdAt || payment.refundedAt || payment.date || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Reason:</span>
              <span className="text-slate-200 font-medium">{primaryRefund.reason || payment.refundReason || 'Customer Service Adjustment'}</span>
            </div>
          </div>

          {/* 4-Stage Visual Timeline */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Refund Lifecycle</h4>
            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {REFUND_STAGES.map((stage, idx) => {
                const isPassed = idx <= activeStageIndex;
                const isCurrent = idx === activeStageIndex;

                return (
                  <div key={stage.key} className="relative flex items-start gap-3.5 pl-1">
                    <div
                      className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all ${
                        isPassed
                          ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/25 ring-4 ring-slate-900'
                          : 'bg-slate-800 text-slate-500 ring-4 ring-slate-900'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <div className="flex-1 -mt-0.5">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${isPassed ? 'text-white' : 'text-slate-500'}`}>
                          {stage.label}
                        </p>
                        {isCurrent && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-full">
                            Current Stage
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{stage.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Information Notice */}
          <div className="flex items-start gap-3 p-3.5 bg-slate-800/40 border border-slate-700/40 rounded-xl text-xs text-slate-400">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              Refunds are automatically settled back to the original source (UPI, Credit/Debit Card, or Net Banking). Bank processing typically takes 5–7 working days.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
