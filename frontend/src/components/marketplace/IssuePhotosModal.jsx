import MediaManager from '../MediaManager';
import { useDialog } from '../../hooks/useDialog';

/** Shown after a custom issue is reported: optional photo upload for the new booking. */
const IssuePhotosModal = ({ bookingId, onDone }) => {
  const { dialogProps, titleId } = useDialog({ isOpen: true, onClose: onDone });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div {...dialogProps} className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 focus:outline-none">
        <h3 id={titleId} className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Upload Issue Photos (Optional)</h3>
        <p className="text-sm text-slate-600 mb-4">Adding photos of the issue can help the garage understand the problem better.</p>
        <MediaManager
          entityId={bookingId}
          entityType="BOOKING"
          category="CUSTOMER_ISSUE"
          label="Vehicle Issue Photos"
          maxFiles={3}
        />
        <div className="pt-4 flex justify-end">
          <button
            type="button"
            onClick={onDone}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default IssuePhotosModal;
