import { Archive, CheckCircle2, Clock, Eye } from 'lucide-react';

export const STATUS_CONFIG = {
  NEW: { label: 'New', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Clock },
  REVIEWED: { label: 'Reviewed', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Eye },
  RESOLVED: { label: 'Resolved', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: CheckCircle2 },
  ARCHIVED: { label: 'Archived', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Archive }
};

export const CATEGORIES = [
  'General Feedback',
  'Booking Issue',
  'Payment Issue',
  'Garage Complaint',
  'Account Issue',
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

export const EMPTY_FILTERS = {
  search: '',
  rating: '',
  category: 'ALL',
  role: 'ALL',
  status: 'ALL',
  startDate: '',
  endDate: ''
};

export const EMPTY_PAGINATION = { page: 1, limit: 10, totalCount: 0, totalPages: 1 };

/** Same query string the page has always sent to GET /admin/feedback. */
export function buildFeedbackQuery(page, filters) {
  const params = new URLSearchParams({ page: String(page), limit: '10' });
  if (filters.search.trim()) params.append('search', filters.search.trim());
  if (filters.rating) params.append('rating', filters.rating);
  if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
  if (filters.role && filters.role !== 'ALL') params.append('role', filters.role);
  if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  return params.toString();
}

export function hasActiveFilters(filters) {
  return Object.keys(EMPTY_FILTERS).some((key) => filters[key] !== EMPTY_FILTERS[key]);
}
