import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  MessageSquare,
  Star,
  Bug,
  Sparkles,
  AlertCircle,
  Clock,
  CheckCircle2,
  Archive,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Trash2,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  Compass,
  Image as ImageIcon,
  Check,
  Calendar
} from 'lucide-react';
import { getPhotoUrl } from '../../utils/imageUrl';
import { useToast } from '../../context/ToastContext';

const STATUS_CONFIG = {
  NEW: { label: 'New', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Clock },
  REVIEWED: { label: 'Reviewed', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Eye },
  RESOLVED: { label: 'Resolved', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: CheckCircle2 },
  ARCHIVED: { label: 'Archived', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Archive }
};

const CATEGORIES = [
  'ALL',
  'General Feedback',
  'Bug Report',
  'Feature Request',
  'UI / Design',
  'Performance Issue',
  'Garage Experience',
  'Vehicle Management',
  'Vehicle Passport',
  'Marketplace',
  'Service Experience',
  'Other'
];

const AdminFeedback = () => {
  const { showToast } = useToast();
  const token = localStorage.getItem('token');

  const headers = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  // State
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState([]);
  const [metrics, setMetrics] = useState({
    totalFeedback: 0,
    averageRating: 0,
    newFeedback: 0,
    bugReports: 0,
    featureRequests: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 1
  });

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [selectedRating, setSelectedRating] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected feedback for detail view / lightbox
  const [selectedItem, setSelectedItem] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchFeedbacks = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const params = new URLSearchParams({
        page: String(page),
        limit: '10'
      });

      if (search.trim()) params.append('search', search.trim());
      if (selectedRating) params.append('rating', selectedRating);
      if (selectedCategory && selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (selectedRole && selectedRole !== 'ALL') params.append('role', selectedRole);
      if (selectedStatus && selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await axios.get(`${apiUrl}/api/admin/feedback?${params.toString()}`, headers);
      if (res.data && res.data.success) {
        setFeedbacks(res.data.feedbacks || []);
        setPagination(res.data.pagination || { page: 1, limit: 10, totalCount: 0, totalPages: 1 });
        if (res.data.metrics) {
          setMetrics(res.data.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to load feedbacks:', err);
      showToast(err.response?.data?.msg || 'Failed to load feedbacks', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, selectedRating, selectedCategory, selectedRole, selectedStatus, startDate, endDate, headers, showToast]);

  useEffect(() => {
    fetchFeedbacks(1);
  }, [fetchFeedbacks]);

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingStatusId(id);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.patch(
        `${apiUrl}/api/admin/feedback/${id}/status`,
        { status: newStatus },
        headers
      );

      if (res.data && res.data.success) {
        showToast(`Feedback status updated to ${newStatus}`, 'success');
        setFeedbacks(prev =>
          prev.map(item => (item._id === id ? { ...item, status: newStatus } : item))
        );
        if (selectedItem && selectedItem._id === id) {
          setSelectedItem(prev => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      showToast(err.response?.data?.msg || 'Failed to update status', 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this feedback item? This action cannot be undone.')) {
      return;
    }
    setDeletingId(id);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.delete(`${apiUrl}/api/admin/feedback/${id}`, headers);
      if (res.data && res.data.success) {
        showToast('Feedback item deleted successfully', 'success');
        if (selectedItem && selectedItem._id === id) setSelectedItem(null);
        fetchFeedbacks(pagination.page);
      }
    } catch (err) {
      showToast(err.response?.data?.msg || 'Failed to delete feedback', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${
              star <= rating
                ? 'fill-amber-400 text-amber-400'
                : 'text-slate-200 stroke-1'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <MessageSquare className="h-7 w-7 text-teal-600" />
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
          <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Feedback</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{metrics.totalFeedback}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <MessageSquare className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Rating</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-amber-600">{metrics.averageRating || '0.0'}</span>
              <span className="text-xs text-slate-400 font-bold">/ 5.0</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
            <Star className="h-5 w-5 fill-amber-400" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Unreviewed</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{metrics.newFeedback}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bug Reports</p>
            <p className="text-2xl font-black text-rose-600 mt-1">{metrics.bugReports}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <Bug className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Feature Requests</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">{metrics.featureRequests}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search & Multi-filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user, email, message text, or page name..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {/* Rating Filter */}
            <select
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="">All Ratings</option>
              <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
              <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
              <option value="3">⭐⭐⭐ (3 Stars)</option>
              <option value="2">⭐⭐ (2 Stars)</option>
              <option value="1">⭐ (1 Star)</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.filter(c => c !== 'ALL').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            {/* Role Filter */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="USER">User / Owner</option>
              <option value="GARAGE">Garage Partner</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <span className="flex items-center gap-1 font-semibold text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-teal-600" /> Date Range:
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {(startDate || endDate || selectedRating || selectedCategory !== 'ALL' || selectedStatus !== 'ALL' || selectedRole !== 'ALL' || search) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedRating('');
                setSelectedCategory('ALL');
                setSelectedStatus('ALL');
                setSelectedRole('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="ml-auto text-xs text-teal-600 hover:text-teal-800 font-bold underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Feedback Table */}
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
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-teal-600 mb-2" />
                    Loading feedback submissions...
                  </td>
                </tr>
              ) : feedbacks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <MessageSquare className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    No feedback found matching the current filters.
                  </td>
                </tr>
              ) : (
                feedbacks.map((item) => {
                  const statusInfo = STATUS_CONFIG[item.status] || STATUS_CONFIG.NEW;
                  return (
                    <tr key={item._id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                            {(item.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate max-w-[140px]">{item.name || 'Anonymous'}</p>
                            <p className="text-[11px] text-slate-400 truncate max-w-[140px]">{item.email || 'No email'}</p>
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
                          {renderStars(item.rating)}
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
                          <p className="text-slate-800 font-medium line-clamp-2 leading-relaxed">
                            {item.message}
                          </p>
                          {item.screenshotUrl && (
                            <button
                              type="button"
                              onClick={() => setLightboxImage(getPhotoUrl(item.screenshotUrl))}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-800 underline cursor-pointer"
                            >
                              <ImageIcon className="h-3 w-3" /> View Screenshot
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Page Context */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div>
                          <p className="font-semibold text-slate-800">{item.pageName || 'App'}</p>
                          <p className="text-[10px] font-mono text-slate-400">{item.pageUrl || '/'}</p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          value={item.status}
                          disabled={updatingStatusId === item._id}
                          onChange={(e) => handleStatusChange(item._id, e.target.value)}
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
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : 'N/A'}
                        <div className="text-[10px] text-slate-400">
                          {item.createdAt ? new Date(item.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : ''}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedItem(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors cursor-pointer"
                            title="View full feedback details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === item._id}
                            onClick={() => handleDelete(item._id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete feedback"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
              onClick={() => fetchFeedbacks(pagination.page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchFeedbacks(pagination.page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Feedback Details</h2>
                  <p className="text-xs text-slate-500">ID: {selectedItem._id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* User Metadata Header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">User</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{selectedItem.name || 'Anonymous'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{selectedItem.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Role</p>
                  <p className="text-xs font-bold text-teal-700">{selectedItem.role || 'USER'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Submitted</p>
                  <p className="text-xs font-bold text-slate-800">
                    {new Date(selectedItem.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Rating & Category */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-amber-50/50 border border-amber-200/50 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-amber-700">{selectedItem.rating} / 5 Stars</span>
                  {renderStars(selectedItem.rating)}
                </div>
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white text-slate-800 border border-slate-200 shadow-xs">
                  {selectedItem.category}
                </span>
              </div>

              {/* Full Message */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Full Message</h4>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs md:text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                  {selectedItem.message}
                </div>
              </div>

              {/* Page Origin */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <Compass className="h-4 w-4 text-teal-600 shrink-0" />
                  <span className="font-bold text-slate-800 truncate">{selectedItem.pageName}</span>
                  <span className="text-slate-400 font-mono text-[11px] truncate">({selectedItem.pageUrl})</span>
                </div>
              </div>

              {/* Screenshot (if attached) */}
              {selectedItem.screenshotUrl && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-teal-600" /> Attached Screenshot
                  </h4>
                  <div
                    onClick={() => setLightboxImage(getPhotoUrl(selectedItem.screenshotUrl))}
                    className="relative group border border-slate-200 rounded-2xl overflow-hidden cursor-pointer bg-slate-100 max-h-64 flex items-center justify-center shadow-xs"
                  >
                    <img
                      src={getPhotoUrl(selectedItem.screenshotUrl)}
                      alt="Feedback attachment"
                      className="max-h-64 object-contain rounded-2xl"
                    />
                    <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                      <Eye className="h-4 w-4" /> Click to enlarge
                    </div>
                  </div>
                </div>
              )}

              {/* Status Selector in Modal */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-xs font-bold text-slate-600">Update Review Status:</span>
                <select
                  value={selectedItem.status}
                  onChange={(e) => handleStatusChange(selectedItem._id, e.target.value)}
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
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 bg-slate-900/70 text-white hover:bg-slate-900 rounded-full shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Enlarged screenshot"
              className="max-h-[85vh] w-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFeedback;
