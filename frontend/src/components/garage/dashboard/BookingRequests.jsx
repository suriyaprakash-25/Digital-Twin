import { useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import BookingCard from './BookingCard';

const TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'TODAY', label: 'Today' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'OVERDUE', label: 'Overdue' },
];

function filterBookings(bookings, tab) {
  const todayStr = new Date().toISOString().split('T')[0];
  return bookings.filter(b => {
    const bDateStr = b.scheduledFor ? new Date(b.scheduledFor).toISOString().split('T')[0] : '';
    if (tab === 'TODAY') return bDateStr === todayStr;
    if (tab === 'UPCOMING') return bDateStr > todayStr;
    if (tab === 'OVERDUE') {
      return (b.status === 'PENDING' || b.status === 'REQUESTED') && (bDateStr < todayStr || (!bDateStr && new Date() - new Date(b.createdAt) > 86400000));
    }
    return true;
  });
}

const BookingRequests = ({ bookings, ...cardProps }) => {
  const [bookingTab, setBookingTab] = useState('ALL');
  const filteredBookings = useMemo(() => filterBookings(bookings, bookingTab), [bookings, bookingTab]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-xl text-teal-600"><CalendarCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Booking Requests</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{bookings.length} total bookings</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center bg-slate-200/70 p-1 rounded-xl gap-1 text-xs font-bold" role="group" aria-label="Filter bookings">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setBookingTab(tab.key)}
              aria-pressed={bookingTab === tab.key}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                bookingTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarCheck className="h-12 w-12 text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium text-sm">No bookings found for &quot;{bookingTab.toLowerCase()}&quot; filter.</p>
          </div>
        ) : (
          filteredBookings.map(b => <BookingCard key={b.id} booking={b} {...cardProps} />)
        )}
      </div>
    </div>
  );
};

export default BookingRequests;
