import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { useToast } from '../../context/toastContextCore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { apiDelete, apiGet, apiPatch, getErrorMessage } from '../../utils/api';
import ErrorState from '../../components/common/ErrorState';
import FeedbackMetrics from '../../components/admin/feedback/FeedbackMetrics';
import FeedbackFilters from '../../components/admin/feedback/FeedbackFilters';
import FeedbackTable from '../../components/admin/feedback/FeedbackTable';
import { FeedbackDetailsModal, FeedbackLightbox } from '../../components/admin/feedback/FeedbackDetailsModal';
import { EMPTY_FILTERS, EMPTY_PAGINATION, buildFeedbackQuery } from '../../components/admin/feedback/feedbackConfig';

const AdminFeedback = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [metrics, setMetrics] = useState({
    totalFeedback: 0,
    averageRating: 0,
    newFeedback: 0,
    bugReports: 0,
    featureRequests: 0
  });
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);

  // Filters (free-text search is debounced so typing does not fire a request per key)
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search, 350);

  // Selected feedback for detail view / lightbox
  const [selectedItem, setSelectedItem] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { rating, category, role, status, startDate, endDate } = filters;

  const fetchFeedbacks = useCallback(async (page = 1) => {
    setLoading(true);
    setLoadError(null);
    try {
      const query = buildFeedbackQuery(page, { search: debouncedSearch, rating, category, role, status, startDate, endDate });
      const data = await apiGet(`/admin/feedback?${query}`);
      if (data && data.success) {
        setFeedbacks(data.feedbacks || []);
        setPagination(data.pagination || EMPTY_PAGINATION);
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load feedbacks'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, rating, category, role, status, startDate, endDate]);

  useEffect(() => {
    fetchFeedbacks(1);
  }, [fetchFeedbacks]);

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleStatusChange = async (id, newStatus) => {
    if (updatingStatusId) return;
    setUpdatingStatusId(id);
    try {
      const data = await apiPatch(`/admin/feedback/${id}/status`, { status: newStatus });

      if (data && data.success) {
        showToast(`Feedback status updated to ${newStatus}`, 'success');
        setFeedbacks(prev =>
          prev.map(item => (item._id === id ? { ...item, status: newStatus } : item))
        );
        if (selectedItem && selectedItem._id === id) {
          setSelectedItem(prev => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update status'), 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDelete = async (id) => {
    if (deletingId) return;
    if (!window.confirm('Are you sure you want to delete this feedback item? This action cannot be undone.')) {
      return;
    }
    setDeletingId(id);
    try {
      const data = await apiDelete(`/admin/feedback/${id}`);
      if (data && data.success) {
        showToast('Feedback item deleted successfully', 'success');
        if (selectedItem && selectedItem._id === id) setSelectedItem(null);
        fetchFeedbacks(pagination.page);
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete feedback'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <MessageSquare className="h-7 w-7 text-teal-600" aria-hidden="true" />
            User Feedback Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review, filter, and track all user feedback, bug reports, and suggestions across DrivePortz.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchFeedbacks(pagination.page)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <FeedbackMetrics metrics={metrics} />

      <FeedbackFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={() => setFilters(EMPTY_FILTERS)}
      />

      {loadError && <ErrorState message={loadError} onRetry={() => fetchFeedbacks(pagination.page)} retrying={loading} />}

      <FeedbackTable
        feedbacks={feedbacks}
        loading={loading}
        pagination={pagination}
        onPageChange={fetchFeedbacks}
        updatingStatusId={updatingStatusId}
        deletingId={deletingId}
        onStatusChange={handleStatusChange}
        onView={setSelectedItem}
        onDelete={handleDelete}
        onOpenImage={setLightboxImage}
      />

      <FeedbackDetailsModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onStatusChange={handleStatusChange}
        onOpenImage={setLightboxImage}
        suspended={Boolean(lightboxImage)}
      />

      <FeedbackLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
};

export default AdminFeedback;
