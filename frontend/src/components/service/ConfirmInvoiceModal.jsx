import { AlertCircle, CheckCircle2, IndianRupee, Loader2, X } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

/** Irreversible-action confirmation shown before a completion-mode invoice is generated. */
const ConfirmInvoiceModal = ({ isOpen, onCancel, onConfirm, isSubmitting, vehicleNumber, serviceCategory, grandTotal }) => {
  const { dialogProps, titleId } = useDialog({ isOpen, onClose: isSubmitting ? undefined : onCancel });
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div {...dialogProps} className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 focus:outline-none">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <h3 id={titleId} className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-amber-500" aria-hidden="true" /> Confirm Invoice Generation
          </h3>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation"
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 md:p-4 rounded-xl text-xs md:text-sm font-semibold">
            This action is irreversible. Once confirmed, an official tax invoice will be generated and the customer will be notified to make the payment.
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">Vehicle</span>
              <span className="font-black text-slate-900">{vehicleNumber || 'Selected Vehicle'}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">Service Category</span>
              <span className="font-bold text-slate-800">{serviceCategory}</span>
            </div>
            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
              <span className="text-sm font-extrabold text-slate-700">Grand Total (Incl. GST)</span>
              <span className="text-xl font-black text-teal-600 font-mono flex items-center">
                <IndianRupee className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" /> {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-sm cursor-pointer"
          >
            Go Back & Edit
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl font-black text-white bg-teal-600 hover:bg-teal-700 shadow-md transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            {isSubmitting ? 'Processing...' : 'Confirm & Generate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmInvoiceModal;
