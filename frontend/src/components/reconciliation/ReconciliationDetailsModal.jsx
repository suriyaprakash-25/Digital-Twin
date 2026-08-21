import { useState } from 'react';
import {
  X,
  Scale,
  IndianRupee,
  Building,
  Car,
  FileText,
  CreditCard,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Check
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';

const ReconciliationDetailsModal = ({ isOpen, onClose, reconciliation, onResolved }) => {
  if (!isOpen || !reconciliation) return null;

  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');

  const isMatched = reconciliation.reconciliationStatus === 'MATCHED';
  const isMismatch = reconciliation.reconciliationStatus === 'MISMATCH';
  const isMissing = reconciliation.reconciliationStatus === 'MISSING';
  const isResolved = reconciliation.reconciliationStatus === 'RESOLVED';

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!resolutionNote.trim()) {
      setError('Please provide a resolution note');
      return;
    }

    setResolving(true);
    setError('');

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/reconciliation/${reconciliation.id}/resolve`,
        { resolutionNote, resolutionAction: 'MANUAL_RESOLUTION' },
        { headers: getAuthHeaders() }
      );

      if (res.data?.success) {
        if (onResolved) onResolved();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve reconciliation record');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
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
              <Scale className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">
              Reconciliation Audit Report
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Invoice: {reconciliation.invoiceNumber || 'Financial Audit'}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative multi-source cross check between Gateway and DrivePortz
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status and Mismatch Type Banner */}
          <div className="flex items-center justify-between p-4 rounded-2xl border bg-slate-50 border-slate-200">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Reconciliation Result
              </span>
              <div className="flex items-center gap-2">
                {isMatched ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> MATCHED
                  </span>
                ) : isMismatch ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-red-700 bg-red-100/70 border border-red-300">
                    <AlertCircle className="h-3.5 w-3.5" /> MISMATCH ({reconciliation.mismatchType})
                  </span>
                ) : isMissing ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-amber-700 bg-amber-100/70 border border-amber-300">
                    <Clock className="h-3.5 w-3.5" /> MISSING FROM GATEWAY
                  </span>
                ) : isResolved ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-purple-700 bg-purple-100/70 border border-purple-300">
                    <Check className="h-3.5 w-3.5" /> RESOLVED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300">
                    {reconciliation.reconciliationStatus}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right text-xs text-slate-400">
              <span>Last Checked</span>
              <span className="font-bold text-slate-700 block">
                {reconciliation.checkedAt ? new Date(reconciliation.checkedAt).toLocaleString('en-IN') : '—'}
              </span>
            </div>
          </div>

          {/* Identifier Comparison */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">DrivePortz ID</span>
              <span className="font-mono text-[11px] font-bold text-slate-800 block truncate">{reconciliation.paymentId}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Razorpay ID</span>
              <span className="font-mono text-[11px] font-bold text-slate-800 block truncate">{reconciliation.razorpayPaymentId || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Order ID</span>
              <span className="font-mono text-[11px] font-bold text-slate-800 block truncate">{reconciliation.razorpayOrderId || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Garage</span>
              <span className="font-bold text-slate-800 block truncate">{reconciliation.garageName || 'Authorized Garage'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Vehicle</span>
              <span className="font-bold text-slate-800 block truncate">{reconciliation.vehicleNumber || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Service</span>
              <span className="font-bold text-slate-800 block truncate">{reconciliation.serviceType || 'Service'}</span>
            </div>
          </div>

          {/* Amount & Status Cross Check Table */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                  <th className="py-2.5 px-4">Financial Metric</th>
                  <th className="py-2.5 px-4">DrivePortz Record</th>
                  <th className="py-2.5 px-4">Razorpay Gateway</th>
                  <th className="py-2.5 px-4 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">Gross Paid Amount</td>
                  <td className="py-3 px-4 font-black text-slate-900">₹{(reconciliation.expectedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 font-black text-slate-900">₹{(reconciliation.razorpayAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 font-black text-right">
                    {reconciliation.amountDifference > 0 ? (
                      <span className="text-red-600">₹{reconciliation.amountDifference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    ) : (
                      <span className="text-emerald-600">₹0.00</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">Payment Status</td>
                  <td className="py-3 px-4 font-bold text-slate-700">{reconciliation.expectedPaymentStatus}</td>
                  <td className="py-3 px-4 font-bold text-slate-700">{reconciliation.razorpayPaymentStatus}</td>
                  <td className="py-3 px-4 text-right">
                    {reconciliation.expectedPaymentStatus?.toLowerCase() === reconciliation.razorpayPaymentStatus?.toLowerCase() || (reconciliation.expectedPaymentStatus === 'CAPTURED' && reconciliation.razorpayPaymentStatus === 'captured') ? (
                      <span className="text-emerald-600 font-bold">Consistent</span>
                    ) : (
                      <span className="text-amber-600 font-bold">Differs</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">Refund Amount</td>
                  <td className="py-3 px-4 font-bold text-slate-700">₹{(reconciliation.expectedRefundAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 font-bold text-slate-700">₹{(reconciliation.razorpayRefundAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-600">
                    ₹{(Math.abs((reconciliation.expectedRefundAmount || 0) - (reconciliation.razorpayRefundAmount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">Currency</td>
                  <td className="py-3 px-4 font-bold text-slate-700">{reconciliation.expectedCurrency || 'INR'}</td>
                  <td className="py-3 px-4 font-bold text-slate-700">{reconciliation.razorpayCurrency || 'INR'}</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600">Match</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mismatch Explanation details */}
          {reconciliation.mismatchDetails && reconciliation.mismatchDetails.length > 0 && (
            <div className="bg-red-50/70 border border-red-200 p-4 rounded-2xl space-y-1.5">
              <h4 className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-red-600" />
                Detected Discrepancies
              </h4>
              <ul className="space-y-1 pl-5 list-disc text-xs text-red-800 font-medium">
                {reconciliation.mismatchDetails.map((m, i) => (
                  <li key={i}>{m.description || m.type}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Resolution section */}
          {isResolved ? (
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl space-y-1 text-xs">
              <span className="font-bold text-purple-900 block">Resolution Note (Resolved on {new Date(reconciliation.resolvedAt).toLocaleDateString('en-IN')})</span>
              <p className="text-purple-800 font-medium">{reconciliation.resolutionNote}</p>
            </div>
          ) : (isMismatch || isMissing) ? (
            <form onSubmit={handleResolve} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
              <h4 className="text-xs font-extrabold text-slate-900">Resolve Discrepancy</h4>
              {error && <p className="text-xs font-bold text-red-600">{error}</p>}
              <textarea
                rows="2"
                required
                placeholder="Explain the audit investigation and resolution rationale..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800"
              />
              <button
                type="submit"
                disabled={resolving}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                {resolving ? 'Saving...' : 'Mark Discrepancy Resolved'}
              </button>
            </form>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReconciliationDetailsModal;
