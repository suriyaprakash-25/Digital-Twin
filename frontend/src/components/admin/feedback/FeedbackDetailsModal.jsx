import { useId } from 'react';
import { Compass, Eye, Image as ImageIcon, MessageSquare, X } from 'lucide-react';
import { getPhotoUrl } from '../../../utils/imageUrl';
import { useDialog } from '../../../hooks/useDialog';
import FeedbackStars from './FeedbackStars';

/** Full view of one feedback submission with a status selector. */
export const FeedbackDetailsModal = ({ item, onClose, onStatusChange, onOpenImage, suspended = false }) => {
  // While the screenshot lightbox is open it owns Escape/focus.
  const { dialogProps, titleId } = useDialog({ isOpen: Boolean(item) && !suspended, onClose });
  const statusId = useId();

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/50 backdrop-blur-xs">
      <div {...dialogProps} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col focus:outline-none">
        {/* Modal Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold" aria-hidden="true">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-extrabold text-slate-900">Feedback Details</h2>
              <p className="text-xs text-slate-500">ID: {item._id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">User</p>
              <p className="text-xs font-bold text-slate-800 truncate">{item.name || 'Anonymous'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Email</p>
              <p className="text-xs font-bold text-slate-800 truncate">{item.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Role</p>
              <p className="text-xs font-bold text-teal-700">{item.role || 'USER'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Submitted</p>
              <p className="text-xs font-bold text-slate-800">{new Date(item.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-amber-50/50 border border-amber-200/50 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-amber-700">{item.rating} / 5 Stars</span>
              <FeedbackStars rating={item.rating} />
            </div>
            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white text-slate-800 border border-slate-200 shadow-xs">
              {item.category}
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Full Message</h3>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs md:text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
              {item.message}
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
            <div className="flex items-center gap-2 truncate">
              <Compass className="h-4 w-4 text-teal-600 shrink-0" aria-hidden="true" />
              <span className="font-bold text-slate-800 truncate">{item.pageName}</span>
              <span className="text-slate-500 font-mono text-[11px] truncate">({item.pageUrl})</span>
            </div>
          </div>

          {item.screenshotUrl && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-teal-600" aria-hidden="true" /> Attached Screenshot
              </h3>
              <button
                type="button"
                onClick={() => onOpenImage(getPhotoUrl(item.screenshotUrl))}
                aria-label="Enlarge attached screenshot"
                className="relative group w-full border border-slate-200 rounded-2xl overflow-hidden cursor-pointer bg-slate-100 max-h-64 flex items-center justify-center shadow-xs"
              >
                <img
                  src={getPhotoUrl(item.screenshotUrl)}
                  alt="Feedback attachment"
                  className="max-h-64 object-contain rounded-2xl"
                />
                <span className="absolute inset-0 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-slate-900 text-xs font-bold gap-1.5">
                  <Eye className="h-4 w-4" aria-hidden="true" /> Click to enlarge
                </span>
              </button>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <label htmlFor={statusId} className="text-xs font-bold text-slate-600">Update Review Status:</label>
            <select
              id={statusId}
              value={item.status}
              onChange={(e) => onStatusChange(item._id, e.target.value)}
              className="text-xs font-bold rounded-xl px-3 py-2 border bg-white border-slate-200 text-slate-800 cursor-pointer focus:ring-2 focus:ring-teal-500"
            >
              <option value="NEW">New</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Full-screen screenshot viewer; click anywhere or press Escape to close. */
export const FeedbackLightbox = ({ src, onClose }) => {
  const { dialogProps } = useDialog({ isOpen: Boolean(src), onClose });
  if (!src) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-60 bg-slate-100/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
    >
      <div {...dialogProps} aria-labelledby={undefined} aria-label="Enlarged screenshot" className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden p-2 shadow-2xl focus:outline-none">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close screenshot"
          className="absolute top-4 right-4 p-2 bg-white/70 text-slate-900 hover:bg-white rounded-full shadow-lg"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <img src={src} alt="Enlarged screenshot" className="max-h-[85vh] w-auto object-contain rounded-2xl" />
      </div>
    </div>
  );
};

export default FeedbackDetailsModal;
