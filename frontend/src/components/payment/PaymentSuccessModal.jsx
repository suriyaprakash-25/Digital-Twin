import { CheckCircle2, IndianRupee, FileText, ArrowRight, ShieldCheck, X } from 'lucide-react';

const PaymentSuccessModal = ({ isOpen, onClose, paymentDetails, onViewBill }) => {
  if (!isOpen || !paymentDetails) return null;

  const {
    amount,
    serviceType,
    garageName,
    vehicleNumber,
    paymentId,
    paidAt
  } = paymentDetails;

  const formattedDate = paidAt
    ? new Date(paidAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-6 text-white text-center relative overflow-hidden">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 shadow-inner border border-white/30">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>

          <h3 className="text-2xl font-black tracking-tight">Payment Successful</h3>
          <p className="text-emerald-100 text-xs font-medium mt-1">Transaction confirmed by Razorpay & DrivePortz</p>
        </div>

        {/* Receipt Body */}
        <div className="p-6 space-y-4">
          {/* Amount Badge */}
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-655 block mb-1">
              Amount Paid
            </span>
            <div className="text-3xl font-black text-slate-900 flex items-center justify-center tracking-tight">
              <IndianRupee className="h-6 w-6 mr-0.5 text-slate-500" />
              {Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Details List */}
          <div className="divide-y divide-slate-100 text-xs md:text-sm font-medium">
            {serviceType && (
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-655">Service</span>
                <span className="font-bold text-slate-800 text-right truncate max-w-[200px]">{serviceType}</span>
              </div>
            )}
            {garageName && (
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-655">Garage</span>
                <span className="font-bold text-slate-800 text-right truncate max-w-[200px]">{garageName}</span>
              </div>
            )}
            {vehicleNumber && (
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-655">Vehicle</span>
                <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                  {vehicleNumber}
                </span>
              </div>
            )}
            {paymentId && (
              <div className="py-2.5 flex justify-between items-center">
                <span className="text-slate-655">Payment ID</span>
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded select-all">
                  {paymentId}
                </span>
              </div>
            )}
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-655">Date</span>
              <span className="font-bold text-slate-700">{formattedDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Digital service bill & passport status updated automatically.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
          {onViewBill && (
            <button
              onClick={() => {
                onClose();
                onViewBill();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs md:text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-xs"
            >
              <FileText className="h-4 w-4" />
              View Bill
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs md:text-sm text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-sm"
          >
            <span>Done</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessModal;
