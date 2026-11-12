import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

const SAFETY_TERMS = /\b(brake|brakes|steering|burst|leak|smoke|fire|overheating)\b/i;

const DURATION_OPTIONS = ['Today', 'A few days ago', 'More than a week ago', 'More than a month ago', 'Not sure'];
const URGENCY_OPTIONS = [
  'Vehicle is working normally',
  'Vehicle is working but has a problem',
  'Difficult to drive',
  'Unable to drive',
  'Not sure',
];

/**
 * "Report a vehicle issue" form. `onSubmit(issueDetails)` performs the request and
 * either resolves (the parent closes the modal) or throws an Error whose message is shown.
 * `precheck()` may return an error message to show instead of submitting.
 */
const CustomIssueModal = ({ onClose, onSubmit, precheck }) => {
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('A few days ago');
  const [urgency, setUrgency] = useState('Vehicle is working but has a problem');
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const { dialogProps, titleId } = useDialog({ isOpen: true, onClose: submitting ? undefined : onClose });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setStatus({ type: '', msg: '' });

    const precheckError = precheck?.();
    if (precheckError) {
      setStatus({ type: 'error', msg: precheckError });
      return;
    }
    if (!description || description.trim().length < 5) {
      setStatus({ type: 'error', msg: 'Please provide a clearer description of the issue.' });
      return;
    }
    if (SAFETY_TERMS.test(description) && !showSafetyWarning) {
      setShowSafetyWarning(true);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ description, duration, urgency });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message || 'Failed to submit issue. Please try again.' });
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div {...dialogProps} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto focus:outline-none">
        <h3 id={titleId} className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-indigo-600" aria-hidden="true" /> Report a Vehicle Issue
        </h3>

        {status.msg && (
          <div
            role={status.type === 'error' ? 'alert' : 'status'}
            className={`p-3 mb-4 rounded-xl text-xs font-semibold ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}
          >
            {status.msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="issue-description" className="block text-xs font-extrabold uppercase text-slate-700 mb-1">What problem are you experiencing? *</label>
            <textarea
              id="issue-description"
              required
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setShowSafetyWarning(false);
              }}
              placeholder="Describe what is happening with your vehicle. For example: My brake pedal feels soft and the vehicle takes longer to stop."
              rows={4}
              maxLength={1000}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label htmlFor="issue-duration" className="block text-xs font-extrabold uppercase text-slate-700 mb-1">When did the problem start?</label>
            <select
              id="issue-duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold focus:outline-none"
            >
              {DURATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="issue-urgency" className="block text-xs font-extrabold uppercase text-slate-700 mb-1">How is the issue affecting your vehicle?</label>
            <select
              id="issue-urgency"
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold focus:outline-none"
            >
              {URGENCY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {showSafetyWarning && (
            <div role="alert" className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" aria-hidden="true" />
                <p className="text-xs text-orange-800 font-semibold">
                  <strong>Safety Notice:</strong> Some vehicle problems may make a vehicle unsafe to drive. If you believe your vehicle is unsafe, avoid driving it and consider appropriate professional or emergency assistance. Click Submit again to proceed.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {submitting ? 'Sending...' : (showSafetyWarning ? 'Acknowledge & Submit' : 'Submit Issue')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomIssueModal;
