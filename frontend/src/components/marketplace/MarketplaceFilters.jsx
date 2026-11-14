import { Search, X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Garages' },
  { value: 'AVAILABLE', label: '🟢 Open Now' },
  { value: 'BUSY', label: '🟡 Busy' },
  { value: 'CLOSED', label: '⚫ Closed' },
];

/** Search box + status filter chips for the garage marketplace. */
const MarketplaceFilters = ({ searchQuery, onSearchChange, statusFilter, onStatusChange }) => (
  <>
    <div className="relative">
      <label htmlFor="marketplace-search" className="sr-only">Search garages</label>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
      <input
        id="marketplace-search"
        type="search"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by garage name or location…"
        className="w-full pl-11 pr-10 py-3 border border-slate-200 rounded-2xl bg-white text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm transition-all"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => onSearchChange('')}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>

    <div role="group" aria-label="Filter by availability" className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {STATUS_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onStatusChange(value)}
          aria-pressed={statusFilter === value}
          className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
            statusFilter === value
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  </>
);

export default MarketplaceFilters;
