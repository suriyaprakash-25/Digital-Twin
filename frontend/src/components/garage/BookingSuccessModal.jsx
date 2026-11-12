import { CheckCircle, Images } from 'lucide-react';
import MediaManager from '../MediaManager';
import { useDialog } from '../../hooks/useDialog';

/** Confirmation after a booking request, with optional photo upload. */
const BookingSuccessModal = ({ bookingId, bookingType, onClose, onDone }) => {
  const { dialogProps, titleId } = useDialog({ isOpen: true, onClose });
  const isIssue = bookingType === 'CUSTOM_ISSUE';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div {...dialogProps} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 focus:outline-none">
        <div className="text-center space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
            <CheckCircle className="h-8 w-8" aria-hidden="true" />
          </div>
          <div>
            <h3 id={titleId} className="text-lg font-extrabold text-slate-900">Booking Requested</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">The garage will review and confirm shortly.</p>
          </div>

          <div className="border border-slate-100 bg-slate-50 rounded-xl p-4 text-left shadow-sm">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Images className="h-4 w-4 text-teal-600" aria-hidden="true" />
              {isIssue ? 'Vehicle Issue Photos' : 'Customer Damage Photos'}
            </h4>
            <p className="text-[10px] text-slate-500 mb-3">
              {isIssue
                ? 'Upload photos demonstrating the problem you are experiencing (Optional).'
                : "Upload photos of your vehicle's condition or specific damage before the service (Optional)."}
            </p>
            <MediaManager
              entityId={bookingId}
              entityType="BOOKING"
              category={isIssue ? 'CUSTOMER_ISSUE' : 'CUSTOMER_DAMAGE'}
              label="Upload Photos"
            />
          </div>

          <button
            type="button"
            onClick={onDone}
            className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingSuccessModal;
