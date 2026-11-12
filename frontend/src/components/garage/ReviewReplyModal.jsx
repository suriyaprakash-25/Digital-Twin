import { useEffect, useId, useState } from 'react';
import { Send } from 'lucide-react';
import { apiPost, getErrorMessage } from '../../utils/api';
import { useDialog } from '../../hooks/useDialog';

/** Garage owner's reply to a customer review. Calls `onPosted` after a successful reply. */
const ReviewReplyModal = ({ garageId, review, onClose, onPosted }) => {
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [posted, setPosted] = useState(false);
  const { dialogProps, titleId } = useDialog({ isOpen: true, onClose });
  const fieldId = useId();

  // Close shortly after a successful post so the confirmation is visible.
  useEffect(() => {
    if (!posted) return undefined;
    const id = setTimeout(onPosted, 1200);
    return () => clearTimeout(id);
  }, [posted, onPosted]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || posted) return;
    if (!replyText || replyText.trim().length < 5) {
      setStatus({ type: 'error', msg: 'Reply message must be at least 5 characters long.' });
      return;
    }
    setSubmitting(true);
    setStatus({ type: '', msg: '' });
    try {
      await apiPost(`/garages/${garageId}/reviews/${review.id}/reply`, { replyMessage: replyText.trim() });
      setStatus({ type: 'success', msg: 'Reply posted successfully!' });
      setPosted(true);
    } catch (err) {
      setStatus({ type: 'error', msg: getErrorMessage(err, 'Failed to post reply.') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div {...dialogProps} className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 focus:outline-none">
        <h3 id={titleId} className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          Reply to {review.userName}&apos;s Review
        </h3>

        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1">
          <div className="font-bold text-slate-800">&quot;{review.reviewTitle || 'Customer Review'}&quot;</div>
          <p className="text-slate-600 italic">&quot;{review.reviewMessage}&quot;</p>
        </div>

        {status.msg && (
          <div
            role={status.type === 'success' ? 'status' : 'alert'}
            className={`p-3 rounded-xl text-xs font-semibold ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}
          >
            {status.msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={fieldId} className="block text-xs font-extrabold uppercase text-slate-700 mb-1">Your Response *</label>
            <textarea
              id={fieldId}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Thank the customer or address their concerns professionally..."
              rows={4}
              className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || posted}
              className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {submitting ? 'Posting...' : <><Send className="w-3.5 h-3.5" aria-hidden="true" /> Post Reply</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewReplyModal;
