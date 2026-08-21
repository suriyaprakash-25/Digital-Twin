import React, { useState } from 'react';
import axios from 'axios';
import { X, ShieldAlert, AlertTriangle, CheckCircle, Clock, FileText, User, Building2, CreditCard, ArrowRight } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function RiskDetailsModal({ event, onClose, onUpdated }) {
  const { showSuccess, showError } = useToast();
  const [action, setAction] = useState('MARK_REVIEWED');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!event) return null;

  const getRiskBadge = (level, score) => {
    switch (level) {
      case 'CRITICAL':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-900/60 text-red-300 border border-red-700">CRITICAL ({score}/100)</span>;
      case 'HIGH':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-900/60 text-orange-300 border border-orange-700">HIGH ({score}/100)</span>;
      case 'MEDIUM':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-900/60 text-amber-300 border border-amber-700">MEDIUM ({score}/100)</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700">LOW ({score}/100)</span>;
    }
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!reviewNote.trim()) {
      showError('Please provide an audit review note.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/admin/risk/${event.id}/action`,
        { action, reviewNote: reviewNote.trim() },
        { headers: getAuthHeaders() }
      );

      if (res.data?.success) {
        showSuccess(res.data.message || 'Risk event status updated');
        if (onUpdated) onUpdated();
        onClose();
      } else {
        showError(res.data?.message || 'Failed to update risk event');
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Error updating risk status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Risk Event Dossier
                {getRiskBadge(event.riskLevel, event.riskScore)}
              </h2>
              <p className="text-xs text-slate-400 font-mono">ID: {event.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Signal Flags */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Triggered Risk Signals</h3>
            {event.riskFlags && event.riskFlags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {event.riskFlags.map((flag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-red-950/60 text-red-300 border border-red-800/80"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {flag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No specific signal flags triggered.</p>
            )}
          </div>

          {/* Transaction & Resource Grid */}
          <div className="grid grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs text-slate-400 block mb-1">Operation</span>
              <span className="text-sm font-semibold text-white uppercase">{event.operation || 'PAYMENT'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-1">Amount</span>
              <span className="text-sm font-bold text-emerald-400">₹{parseFloat(event.amount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-1">Payment / Order ID</span>
              <span className="text-xs font-mono text-slate-300 break-all">{event.paymentId || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-1">Invoice Reference</span>
              <span className="text-xs font-mono text-cyan-400">{event.invoiceId || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-1">User ID</span>
              <span className="text-xs font-mono text-slate-300">{event.userId || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-1">Garage ID</span>
              <span className="text-xs font-mono text-slate-300">{event.garageId || '—'}</span>
            </div>
          </div>

          {/* Review History */}
          {event.reviewedAt && (
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Status: <strong className="text-white">{event.status}</strong></span>
                <span>Reviewed: {new Date(event.reviewedAt).toLocaleString()}</span>
              </div>
              <p className="text-slate-300 mt-2"><strong className="text-slate-400">Note:</strong> {event.reviewNote}</p>
            </div>
          )}

          {/* Action Form */}
          <form onSubmit={handleActionSubmit} className="space-y-4 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Administrative Resolution</h3>
            
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'MARK_REVIEWED', label: 'Mark Reviewed', desc: 'Accept and close review' },
                { id: 'CLEAR_RISK', label: 'Clear Risk', desc: 'False positive flag' },
                { id: 'ESCALATE', label: 'Escalate', desc: 'Require further investigation' }
              ].map(opt => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setAction(opt.id)}
                  className={`p-3 rounded-xl text-left border transition ${
                    action === opt.id
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Review & Audit Note *</label>
              <textarea
                rows={3}
                required
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Explain the review outcome or justification..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Submit Resolution'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
