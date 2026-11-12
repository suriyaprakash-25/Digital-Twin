import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

/** Owner reply when a garage asks for more information on a booking. */
const ProvideInfoModal = ({ onClose, onSubmit }) => {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { dialogProps, titleId } = useDialog({ isOpen: true, onClose: submitting ? undefined : onClose });

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div {...dialogProps} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 focus:outline-none">
        <h3 id={titleId} className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
          Provide Information
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="provide-info-message" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
              Message to Garage
            </label>
            <textarea
              id="provide-info-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please describe..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all resize-none h-24"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!message.trim() || submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Submit Info
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProvideInfoModal;
