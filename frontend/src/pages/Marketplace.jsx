import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { MapPin, Navigation, Search, X, ShieldCheck } from 'lucide-react';
import SEO from '../components/SEO';
import { useToast } from '../context/ToastContext';

const Marketplace = () => {
  const { showToast } = useToast();
  const [garages, setGarages] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, AVAILABLE, BUSY, CLOSED

  const token = localStorage.getItem('token');

  const headers = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`
      }
    }),
    [token]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError('');
      setIsLoading(true);
      try {
        const [mRes, vRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/marketplace`),
          axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/vehicles/myvehicles`, headers)
        ]);

        if (cancelled) return;
        const garagesData = Array.isArray(mRes.data) ? mRes.data : [];
        setGarages(garagesData);

        const vehiclesData = Array.isArray(vRes.data) ? vRes.data : [];
        setVehicles(vehiclesData);
        if (vehiclesData.length > 0) setSelectedVehicleId(vehiclesData[0].id);
      } catch (e) {
        if (cancelled) return;
        setError(e.response?.data?.msg || 'Failed to load marketplace');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();

    // 30-second polling for real-time availability updates
    const intervalId = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [headers]);

  const requestBooking = async ({ garageId, serviceId, serviceTitle, garageName }) => {
    setError('');
    setMessage('');

    if (!selectedVehicleId) {
      showToast('Please add/select a vehicle first.', 'warning');
      return;
    }

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings`,
        {
          garageId,
          serviceId,
          vehicleId: selectedVehicleId,
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
          notes
        },
        headers
      );

      showToast(`Booking requested for ${serviceTitle || 'service'}! The garage will respond soon.`, 'success');
    } catch (e) {
      showToast(e.response?.data?.msg || 'Failed to request booking', 'error');
    }
  };

  const filteredGarages = useMemo(() => {
    let result = garages;
    
    // 1. Filter by Status
    if (statusFilter !== 'ALL') {
      result = result.filter(g => g.currentStatus === statusFilter);
    }

    // 2. Filter by Search Query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(g =>
        (g.name || '').toLowerCase().includes(q) ||
        (g.city || '').toLowerCase().includes(q) ||
        (g.address || '').toLowerCase().includes(q)
      );
    }

    // 3. Sort: AVAILABLE -> BUSY -> CLOSED
    const statusWeight = { 'AVAILABLE': 1, 'BUSY': 2, 'CLOSED': 3 };
    result.sort((a, b) => {
      const weightA = statusWeight[a.currentStatus] || 4;
      const weightB = statusWeight[b.currentStatus] || 4;
      return weightA - weightB;
    });

    return result;
  }, [garages, searchQuery, statusFilter]);

  return (
    <>
      <SEO 
        title="Find Top-Rated Auto Repair Garages" 
        description="Search, compare, and book trusted auto repair garages near you. Read reviews and get instant service quotes on Driveportz Marketplace." 
      />
      <div className="space-y-6 sm:space-y-8 pb-12 lg:pb-8">
        <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Garages</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm sm:text-base">Choose a garage service and request a booking</p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by garage name or location…"
          className="w-full pl-11 pr-10 py-3 border border-slate-200 rounded-2xl bg-white text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['ALL', 'AVAILABLE', 'BUSY', 'CLOSED'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
              statusFilter === status 
                ? 'bg-slate-900 text-white border-slate-900' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {status === 'ALL' ? 'All Garages' : 
             status === 'AVAILABLE' ? '🟢 Open Now' : 
             status === 'BUSY' ? '🟡 Busy' : '⚫ Closed'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}
      {message && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-xl text-sm font-medium">
          {message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700">Vehicle</label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNumber}
                </option>
              ))}
            </select>
            {vehicles.length === 0 ? <div className="text-xs text-slate-500 mt-2">No vehicles available.</div> : null}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">Preferred date & time</label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? <div className="text-slate-500 text-sm">Loading...</div> : null}

        {!isLoading && filteredGarages.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {searchQuery ? `No garages found for "${searchQuery}"` : 'No garages listed yet.'}
          </div>
        ) : null}

        {filteredGarages.map((g) => (
          <div key={g.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-4">
                <div>
                <div className="text-lg font-extrabold text-slate-900 flex flex-wrap items-center gap-2">
                  {g.name}
                  {g.verified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-bold">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  )}
                  {/* Status Badge */}
                  <div className={`px-2 py-0.5 rounded-full flex items-center gap-1.5 text-xs font-bold border ml-1
                    ${g.currentStatus === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      g.currentStatus === 'BUSY' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                      'bg-slate-50 text-slate-600 border-slate-200'}`}
                  >
                    {g.currentStatus === 'AVAILABLE' && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
                    {g.currentStatus === 'BUSY' && <span className="h-2 w-2 rounded-full bg-amber-500"></span>}
                    {g.currentStatus === 'CLOSED' && <span className="h-2 w-2 rounded-full bg-slate-400"></span>}
                    {g.currentStatus === 'AVAILABLE' ? 'Open Now' : g.currentStatus === 'BUSY' ? 'Busy' : 'Closed'}
                  </div>

                  {/* Slots Available Badge */}
                  <div className={`px-2 py-0.5 rounded-full text-xs font-bold border ml-1
                    ${(g.maxCapacity - g.activeBookingsCount) <= 0 
                      ? 'bg-rose-50 text-rose-700 border-rose-200' 
                      : (g.maxCapacity - g.activeBookingsCount) <= 5
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'}`}
                  >
                    {(g.maxCapacity - g.activeBookingsCount) <= 0 
                      ? '🚫 Full (0 slots left)' 
                      : `Slots: ${g.maxCapacity - g.activeBookingsCount} / ${g.maxCapacity} remaining`}
                  </div>
                </div>
                <div className="text-sm text-slate-600 mt-1">{[g.address, g.city].filter(Boolean).join(', ')}</div>
                {g.phone ? <div className="text-sm text-slate-600 mt-1">Phone: {g.phone}</div> : null}
                {g.description ? <div className="text-sm text-slate-600 mt-2">{g.description}</div> : null}
              </div>
              <div>
                {g.garageLocation?.latitude && g.garageLocation?.longitude ? (
                  <a
                    href={`https://www.google.com/maps?q=${g.garageLocation.latitude},${g.garageLocation.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-sm font-bold hover:bg-teal-100 transition-all"
                  >
                    <Navigation className="h-4 w-4" />
                    Show Location
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed">
                    <MapPin className="h-3.5 w-3.5" /> No location set
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(g.services || []).length === 0 ? (
                <div className="text-slate-500 text-sm">No services listed.</div>
              ) : (
                g.services.map((s) => (
                  <div key={s.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">{s.title}</div>
                        {s.description ? <div className="text-sm text-slate-600 mt-1">{s.description}</div> : null}
                        <div className="text-xs text-slate-500 mt-2 flex flex-col gap-1">
                          <div>
                            {s.price !== null && s.price !== undefined ? `₹${s.price}` : 'Price: —'}
                            {s.durationMins ? ` • ${s.durationMins} mins` : ''}
                          </div>
                          {g.currentStatus === 'BUSY' && <span className="text-amber-600 font-semibold text-[10px]">Garage is busy, expect delays</span>}
                        </div>
                      </div>

                      <button
                        onClick={() => requestBooking({ garageId: g.id, serviceId: s.id, serviceTitle: s.title, garageName: g.name })}
                        disabled={vehicles.length === 0 || g.currentStatus === 'CLOSED' || (g.maxCapacity - g.activeBookingsCount) <= 0}
                        title={
                          g.currentStatus === 'CLOSED' 
                            ? 'Garage is currently closed' 
                            : (g.maxCapacity - g.activeBookingsCount) <= 0 
                              ? 'Garage is at full capacity' 
                              : ''
                        }
                        className={`px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all ${
                          g.currentStatus === 'CLOSED' || (g.maxCapacity - g.activeBookingsCount) <= 0
                            ? 'bg-slate-350 cursor-not-allowed text-slate-500' 
                            : 'bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                      >
                        {g.currentStatus === 'CLOSED' 
                          ? 'Closed' 
                          : (g.maxCapacity - g.activeBookingsCount) <= 0 
                            ? 'Full' 
                            : 'Request'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
    </>
  );
};

export default Marketplace;
