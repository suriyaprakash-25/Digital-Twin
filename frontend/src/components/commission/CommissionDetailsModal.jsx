import {
  X,
  Percent,
  IndianRupee,
  Building,
  Car,
  FileText,
  CreditCard,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';

const CommissionDetailsModal = ({ isOpen, onClose, earning, onViewInvoice }) => {
  if (!isOpen || !earning) return null;

  const gross = parseFloat(earning.grossAmount) || 0;
  const comm = parseFloat(earning.platformCommission) || 0;
  const net = parseFloat(earning.garageNetAmount) || 0;
  const refund = parseFloat(earning.refundAmount) || 0;
  const finalNet = parseFloat(earning.netAfterRefund !== undefined ? earning.netAfterRefund : net) || 0;
  const rate = earning.commissionRate || 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <Percent className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">
              Commission Breakdown
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            {earning.invoiceNumber || 'Financial Ledger Entry'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative revenue sharing calculation snapshot
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Service</span>
              <span className="font-bold text-slate-800 block truncate">{earning.serviceType || 'Automotive Service'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Vehicle</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <Car className="h-3.5 w-3.5 text-slate-400" />
                {earning.vehicleNumber || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Garage</span>
              <span className="font-bold text-slate-800 block truncate">{earning.garageName || 'Authorized Service'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Payment ID</span>
              <span className="font-mono text-[11px] font-bold text-slate-700 block truncate">
                {earning.razorpayPaymentId || earning.paymentId || '—'}
              </span>
            </div>
          </div>

          {/* Financial Calculation Steps */}
          <div className="border border-slate-100 rounded-2xl p-4 space-y-3 bg-white shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Customer Paid (Gross Bill)</span>
              <span className="font-bold text-slate-900 text-sm">₹{gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2 text-red-600">
              <span className="flex items-center gap-1">
                <span>DrivePortz Platform Fee ({rate}%)</span>
              </span>
              <span className="font-bold">- ₹{comm.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2 text-emerald-700 font-bold bg-emerald-50/50 p-2 rounded-xl">
              <span>Net Garage Earnings</span>
              <span className="text-base font-black">₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            {refund > 0 && (
              <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2 text-violet-700">
                <span className="flex items-center gap-1">
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Refund Adjustment</span>
                </span>
                <span className="font-bold">- ₹{refund.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}

            {refund > 0 && (
              <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2 text-slate-900 font-bold bg-slate-50 p-2 rounded-xl">
                <span>Final Adjusted Garage Earnings</span>
                <span className="text-base font-black text-slate-900">₹{finalNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          {/* Status badge & snapshot notice */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Ledger Settlement Status</span>
            <span className="font-bold px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
              {earning.status || 'AVAILABLE'}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Commission rate is snapshotted at time of payment capture and is immutable.
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {onViewInvoice && earning.invoiceId && (
            <button
              onClick={() => {
                onClose();
                onViewInvoice(earning.invoiceId);
              }}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              View Invoice
            </button>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors ml-auto shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommissionDetailsModal;
