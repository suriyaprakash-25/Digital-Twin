import { ChevronLeft, ChevronRight, Eye, Image as ImageIcon, MessageSquare, RefreshCw, Trash2 } from 'lucide-react';
import { getPhotoUrl } from '../../../utils/imageUrl';
import FeedbackStars from './FeedbackStars';
import { STATUS_CONFIG } from './feedbackConfig';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A');
const formatTime = (value) => (value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

const FeedbackRow = ({ item, updatingStatusId, deletingId, onStatusChange, onView, onDelete, onOpenImage }) => {
  const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.NEW;
  return (
    <tr className="hover:bg-slate-50/60 transition-colors group">
      {/* User Info */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-slate-900 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs" aria-hidden="true">
            {(item.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate max-w-[140px]">{item.name || 'Anonymous'}</p>
            <p className="text-[11px] text-slate-500 truncate max-w-[140px]">{item.email || 'No email'}</p>
            <span className="inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
              {item.role || 'USER'}
            </span>
          </div>
        </div>
      </td>

      {/* Rating */}
      <td className="py-3.5 px-4 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span className="font-black text-slate-800">{item.rating}</span>
          <FeedbackStars rating={item.rating} />
        </div>
      </td>

      {/* Category */}
      <td className="py-3.5 px-4 whitespace-nowrap">
        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60 inline-block">
          {item.category}
        </span>
      </td>

      {/* Message Preview */}
      <td className="py-3.5 px-4 max-w-xs">
        <div className="space-y-1">
          <p className="text-slate-800 font-medium line-clamp-2 leading-relaxed">{item.message}</p>
          {item.screenshotUrl && (
            <button
              type="button"
              onClick={() => onOpenImage(getPhotoUrl(item.screenshotUrl))}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-800 underline cursor-pointer"
            >
              <ImageIcon className="h-3 w-3" aria-hidden="true" /> View Screenshot
            </button>
          )}
        </div>
      </td>

      {/* Page Context */}
      <td className="py-3.5 px-4 whitespace-nowrap">
        <div>
          <p className="font-semibold text-slate-800">{item.pageName || 'App'}</p>
          <p className="text-[10px] font-mono text-slate-500">{item.pageUrl || '/'}</p>
        </div>
      </td>

      {/* Status */}
      <td className="py-3.5 px-4 whitespace-nowrap">
        <select
          aria-label={`Status for feedback from ${item.name || 'Anonymous'}`}
          value={item.status}
          disabled={updatingStatusId === item._id}
          onChange={(e) => onStatusChange(item._id, e.target.value)}
          className={`text-xs font-bold rounded-lg px-2.5 py-1 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${statusInfo.color}`}
        >
          <option value="NEW">New</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="RESOLVED">Resolved</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </td>

      {/* Date */}
      <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-500">
        {formatDate(item.createdAt)}
        <div className="text-[10px] text-slate-500">{formatTime(item.createdAt)}</div>
      </td>

      {/* Actions */}
      <td className="py-3.5 px-4 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onView(item)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors cursor-pointer"
            title="View full feedback details"
            aria-label="View full feedback details"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={deletingId === item._id}
            onClick={() => onDelete(item._id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
            title="Delete feedback"
            aria-label="Delete feedback"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
};

/** Feedback list with row actions and pagination footer. */
const FeedbackTable = ({ feedbacks, loading, pagination, onPageChange, ...rowProps }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <th className="py-3.5 px-4">User</th>
            <th className="py-3.5 px-4">Rating</th>
            <th className="py-3.5 px-4">Category</th>
            <th className="py-3.5 px-4">Feedback Message</th>
            <th className="py-3.5 px-4">Page Context</th>
            <th className="py-3.5 px-4">Status</th>
            <th className="py-3.5 px-4">Date</th>
            <th className="py-3.5 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {loading ? (
            <tr>
              <td colSpan={8} className="py-12 text-center text-slate-500" role="status">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-teal-600 mb-2" aria-hidden="true" />
                Loading feedback submissions...
              </td>
            </tr>
          ) : feedbacks.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12 text-center text-slate-500">
                <MessageSquare className="h-8 w-8 mx-auto text-slate-600 mb-2" aria-hidden="true" />
                No feedback found matching the current filters.
              </td>
            </tr>
          ) : (
            feedbacks.map((item) => <FeedbackRow key={item._id} item={item} {...rowProps} />)
          )}
        </tbody>
      </table>
    </div>

    {/* Pagination Bar */}
    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
      <div>
        Showing <strong className="text-slate-800">{feedbacks.length}</strong> of{' '}
        <strong className="text-slate-800">{pagination.totalCount}</strong> feedback submissions
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pagination.page <= 1 || loading}
          onClick={() => onPageChange(pagination.page - 1)}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="px-3 py-1 font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages || loading}
          onClick={() => onPageChange(pagination.page + 1)}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
);

export default FeedbackTable;
