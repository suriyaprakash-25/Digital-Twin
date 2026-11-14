import { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

/** Reason prompt shown before an admin rejects a settlement request. */
const RejectSettlementDialog = ({ settlement, onCancel, onSubmit, submitting = false }) => {
  const [reason, setReason] = useState('');
  const { dialogProps, titleId } = useDialog({ isOpen: Boolean(settlement), onClose: onCancel });
  const reasonId = useId();

  if (!settlement) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;
    onSubmit(reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white backdrop-blur-xs">
      <div {...dialogProps} className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 focus:outline-none">
        <h3 id={titleId} className="text-base font-black text-slate-900">
          Reject Settlement Request
        </h3>
        <p className="text-xs text-slate-500">
          Rejecting {settlement.settlementId} will unlock ₹{Number(settlement.requestedAmount).toLocaleString('en-IN')} back to the garage's available balance.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor={reasonId} className="sr-only">Rejection reason</label>
          <textarea
            id={reasonId}
            required
            rows="3"
            placeholder="Specify rejection reason (e.g. Bank details unverified)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-900 bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Confirm Rejection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectSettlementDialog;
