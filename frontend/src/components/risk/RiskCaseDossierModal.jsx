import { useId } from 'react';
import { Loader2, X } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

export const RiskLevelBadge = ({ level }) => {
  if (level === 'CRITICAL') return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">CRITICAL</span>;
  if (level === 'HIGH') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">HIGH</span>;
  if (level === 'MEDIUM') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40">MEDIUM</span>;
  return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">LOW</span>;
};

const ACTIONS = [
  { kind: 'action', value: 'HOLD_SETTLEMENT', label: 'Place Settlement Hold', className: 'px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition' },
  { kind: 'action', value: 'ESCALATE', label: 'Escalate Case', className: 'px-3.5 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition' },
  { kind: 'resolve', value: 'FALSE_POSITIVE', label: 'False Positive', className: 'px-3.5 py-2 bg-slate-100 hover:bg-slate-700 text-slate-600 rounded-xl text-xs font-semibold transition' },
  { kind: 'resolve', value: 'CONFIRMED', label: 'Confirm Fraud', className: 'px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition' },
];

/** Investigation dossier for a correlated risk case, with admin actions. */
const RiskCaseDossierModal = ({ riskCase, onClose, note, onNoteChange, pendingAction, onAction, onResolve }) => {
  const { dialogProps, titleId } = useDialog({ isOpen: Boolean(riskCase), onClose });
  const noteId = useId();

  if (!riskCase) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-100/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div {...dialogProps} className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl focus:outline-none">

        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h3 id={titleId} className="text-lg font-black text-slate-900">{riskCase.riskCaseNumber}</h3>
            <span className="text-xs text-slate-500">Risk Investigation Dossier</span>
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

        {/* Score & Badges */}
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
          <div>
            <span className="text-xs text-slate-500 block mb-1">Risk Score</span>
            <span className="text-2xl font-black text-slate-900">{riskCase.score} / 100</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 block mb-1">Risk Level</span>
            <RiskLevelBadge level={riskCase.riskLevel} />
          </div>
        </div>

        {/* Evidence & Signals */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Explainable Signals Triggered</h4>
          <div className="flex flex-wrap gap-1.5">
            {riskCase.signals?.map((s, i) => (
              <span key={i} className="px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-semibold">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Evidence JSON summary */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Correlated Entity Evidence</h4>
          <pre className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-600 font-mono overflow-x-auto">
            {JSON.stringify(riskCase.evidence || {}, null, 2)}
          </pre>
        </div>

        {/* Action Note input */}
        <div className="space-y-2">
          <label htmlFor={noteId} className="text-xs font-bold uppercase tracking-wider text-slate-500">Investigation Note / Justification</label>
          <textarea
            id={noteId}
            rows={2}
            placeholder="Enter investigation findings, rationale, or instructions..."
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-500"
          />
        </div>

        {/* Admin Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-slate-200">
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              type="button"
              disabled={Boolean(pendingAction)}
              onClick={() => (a.kind === 'action' ? onAction(a.value) : onResolve(a.value))}
              className={`inline-flex items-center gap-1.5 disabled:opacity-60 ${a.className}`}
            >
              {pendingAction === a.value && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              {a.label}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
};

export default RiskCaseDossierModal;
