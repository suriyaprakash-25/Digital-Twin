import React, { useState } from 'react';
import axios from 'axios';
import { X, ShieldAlert, AlertTriangle, Lock } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function SettlementHoldModal({ settlement, onClose, onUpdated }) {
  const { showSuccess, showError } = useToast();
  const [reason, setReason] = useState('RISK_REVIEW');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!settlement) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmed) {
      showError('Please check the confirmation box to proceed');
      return;
    }
    if (!note.trim()) {
      showError('Please provide an administrative note for this hold');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/admin/settlements/${settlement.settlementId || settlement._id}/hold`,
        { reason, note: note.trim(), confirmation: true },
        { headers: getAuthHeaders() }
      );

      if (res.data?.success) {
        showSuccess('Settlement hold placed successfully');
        if (onUpdated) onUpdated();
        onClose();
      } else {
        showError(res.data?.message || 'Failed to place hold');
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Error placing hold');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Place Settlement Hold</h2>
              <span className="text-xs text-slate-400 font-mono">{settlement.settlementId}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Hold Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="RISK_REVIEW">Risk Engine Review (High / Critical Risk)</option>
              <option value="RECONCILIATION_ISSUE">Reconciliation Mismatch</option>
              <option value="DISPUTE">Active Customer Dispute In Progress</option>
              <option value="KYC_REVIEW">Partner KYC / Profile Compliance Review</option>
              <option value="PAYOUT_PROFILE_ISSUE">Payout Account / IFSC Irregularity</option>
              <option value="MANUAL_ADMIN_HOLD">Administrative Discretionary Hold</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Audit Note / Explanation</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="State the justification for locking payouts for this settlement..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              required
            />
          </div>

          <div className="bg-amber-950/30 border border-amber-800/40 p-3 rounded-xl flex items-start gap-2.5">
            <input
              type="checkbox"
              id="confirmHold"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="confirmHold" className="text-xs text-amber-200 cursor-pointer">
              I confirm that placing this hold will immediately block payout processing and trigger financial audit logging.
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !confirmed}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition disabled:opacity-50"
            >
              {isSubmitting ? 'Placing Hold...' : 'Confirm Place Hold'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
