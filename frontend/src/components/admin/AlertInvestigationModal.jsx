import { useId } from 'react';
import { Loader2, X } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

export const SeverityBadge = ({ severity }) => {
  if (severity === 'CRITICAL') return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">CRITICAL</span>;
  if (severity === 'HIGH') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">HIGH</span>;
  if (severity === 'WARNING') return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-500/20 text-yellow-400">WARNING</span>;
  return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">INFO</span>;
};

/** Admin modal to inspect, acknowledge or resolve a financial alert. */
const AlertInvestigationModal = ({
  alert,
  onClose,
  resolveNote,
  onResolveNoteChange,
  pendingAction,
  onAcknowledge,
  onResolve,
}) => {
  const { dialogProps, titleId } = useDialog({ isOpen: Boolean(alert), onClose });
  const noteId = useId();

  if (!alert) return null;
  const busy = Boolean(pendingAction);

  return (
    <div className="fixed inset-0 z-50 bg-slate-100/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div {...dialogProps} className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl p-6 space-y-6 shadow-2xl focus:outline-none">

        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 id={titleId} className="text-lg font-black text-slate-900">{alert.alertNumber}</h3>
            <span className="text-xs text-slate-500">{alert.alertType}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Severity:</span>
            <SeverityBadge severity={alert.severity} />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Status:</span>
            <span className="font-bold text-slate-900">{alert.status}</span>
          </div>
          <div className="pt-2 border-t border-slate-900">
            <span className="text-slate-500 block mb-1">Message:</span>
            <p className="text-slate-900 font-medium">{alert.message}</p>
          </div>
        </div>

        {alert.status !== 'RESOLVED' && (
          <div className="space-y-2">
            <label htmlFor={noteId} className="text-xs font-bold uppercase tracking-wider text-slate-500">Resolution Note</label>
            <textarea
              id={noteId}
              rows={2}
              placeholder="Enter resolution details, action taken..."
              value={resolveNote}
              onChange={(e) => onResolveNoteChange(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-500"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
          {alert.status === 'OPEN' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAcknowledge(alert.alertNumber)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-slate-900 rounded-xl text-xs font-bold transition disabled:opacity-60"
            >
              {pendingAction === 'acknowledge' && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              Acknowledge Alert
            </button>
          )}

          {alert.status !== 'RESOLVED' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onResolve(alert.alertNumber)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-60"
            >
              {pendingAction === 'resolve' && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              Resolve Alert
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default AlertInvestigationModal;
