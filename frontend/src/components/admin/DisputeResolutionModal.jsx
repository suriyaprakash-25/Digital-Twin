import { useId, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

/**
 * Admin form to resolve a customer dispute (refund / correction / close / reject).
 * Owns its own form state; mount it with `key={dispute.id}` so it resets per dispute.
 * `onSubmit({ resolution, resolutionNote, refundAmount })` performs the request.
 */
const DisputeResolutionModal = ({ dispute, onClose, onSubmit, submitting = false, error = '' }) => {
  const [resolutionAction, setResolutionAction] = useState('REFUND_FULL');
  const [resolutionNote, setResolutionNote] = useState('');
  const [customRefundAmount, setCustomRefundAmount] = useState(dispute?.disputedAmount ?? '');
  const [localError, setLocalError] = useState('');
  const { dialogProps, titleId } = useDialog({ isOpen: Boolean(dispute), onClose });
  const actionId = useId();
  const amountId = useId();
  const noteId = useId();

  if (!dispute) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!resolutionNote.trim()) {
      setLocalError('Please provide a resolution note');
      return;
    }
    setLocalError('');
    onSubmit({
      resolution: resolutionAction,
      resolutionNote,
      refundAmount: resolutionAction === 'REFUND_PARTIAL' ? customRefundAmount : undefined
    });
  };

  const shownError = localError || error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white backdrop-blur-xs animate-in fade-in duration-200">
      <div {...dialogProps} className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 focus:outline-none">
        <div className="bg-white text-slate-900 p-6 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 text-slate-500 hover:text-slate-900 p-1 rounded-full hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold bg-slate-100 text-amber-400 px-2 py-0.5 rounded">
              {dispute.disputeNumber}
            </span>
            <span className="text-xs text-slate-500">{dispute.invoiceNumber}</span>
          </div>
          <h3 id={titleId} className="text-base font-black text-slate-900">{dispute.subject}</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {shownError && <p role="alert" className="text-xs font-bold text-red-600">{shownError}</p>}

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Claimed Amount</span>
              <span className="font-black text-slate-900">₹{Number(dispute.disputedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Garage</span>
              <span className="font-bold text-slate-800 truncate block">{dispute.garageName}</span>
            </div>
          </div>

          <div>
            <label htmlFor={actionId} className="block text-xs font-bold text-slate-700 mb-1">
              Resolution Action *
            </label>
            <select
              id={actionId}
              value={resolutionAction}
              onChange={(e) => setResolutionAction(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-500"
            >
              <option value="REFUND_FULL">Full Refund to Customer (₹{dispute.disputedAmount})</option>
              <option value="REFUND_PARTIAL">Partial Refund to Customer</option>
              <option value="INVOICE_CORRECTION">Invoice Correction (No Direct Refund)</option>
              <option value="NO_ACTION">Close Dispute (No Financial Action)</option>
              <option value="REJECT_DISPUTE">Reject Dispute (Dismiss Customer Claim)</option>
            </select>
          </div>

          {resolutionAction === 'REFUND_PARTIAL' && (
            <div>
              <label htmlFor={amountId} className="block text-xs font-bold text-slate-700 mb-1">
                Custom Refund Amount (₹) *
              </label>
              <input
                id={amountId}
                type="number"
                step="0.01"
                required
                value={customRefundAmount}
                onChange={(e) => setCustomRefundAmount(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
          )}

          <div>
            <label htmlFor={noteId} className="block text-xs font-bold text-slate-700 mb-1">
              Resolution Decision Rationale *
            </label>
            <textarea
              id={noteId}
              rows="3"
              required
              placeholder="Document the resolution rationale sent to customer and garage..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 rounded-xl shadow-xs disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {submitting ? 'Processing...' : 'Confirm Resolution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DisputeResolutionModal;
