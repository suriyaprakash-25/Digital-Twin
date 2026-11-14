import { Calendar, Search, X } from 'lucide-react';
import { CATEGORIES, hasActiveFilters } from './feedbackConfig';

const SELECT_CLASS = 'bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer';
const DATE_CLASS = 'bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500';

/** Search box, quick filters and date range for the admin feedback list. */
const FeedbackFilters = ({ filters, onChange, onReset }) => (
  <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
    <div className="flex flex-col md:flex-row items-center gap-3">
      {/* Search Bar */}
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" aria-hidden="true" />
        <input
          type="search"
          aria-label="Search feedback"
          value={filters.search}
          onChange={(e) => onChange('search', e.target.value)}
          placeholder="Search by user, email, message text, or page name..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => onChange('search', '')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 p-1"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
        <select aria-label="Filter by rating" value={filters.rating} onChange={(e) => onChange('rating', e.target.value)} className={SELECT_CLASS}>
          <option value="">All Ratings</option>
          <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
          <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
          <option value="3">⭐⭐⭐ (3 Stars)</option>
          <option value="2">⭐⭐ (2 Stars)</option>
          <option value="1">⭐ (1 Star)</option>
        </select>

        <select aria-label="Filter by category" value={filters.category} onChange={(e) => onChange('category', e.target.value)} className={SELECT_CLASS}>
          <option value="ALL">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select aria-label="Filter by status" value={filters.status} onChange={(e) => onChange('status', e.target.value)} className={SELECT_CLASS}>
          <option value="ALL">All Statuses</option>
          <option value="NEW">New</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="RESOLVED">Resolved</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        <select aria-label="Filter by role" value={filters.role} onChange={(e) => onChange('role', e.target.value)} className={SELECT_CLASS}>
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
        <Calendar className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" /> Date Range:
      </span>
      <input type="date" aria-label="From date" value={filters.startDate} onChange={(e) => onChange('startDate', e.target.value)} className={DATE_CLASS} />
      <span>to</span>
      <input type="date" aria-label="To date" value={filters.endDate} onChange={(e) => onChange('endDate', e.target.value)} className={DATE_CLASS} />
      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto text-xs text-teal-600 hover:text-teal-800 font-bold underline cursor-pointer"
        >
          Reset Filters
        </button>
      )}
    </div>
  </div>
);

export default FeedbackFilters;
