import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { MapPin, Navigation, Search, X } from 'lucide-react';

const Marketplace = () => {
  const [garages, setGarages] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
          axios.get('http://localhost:5000/api/marketplace'),
          axios.get('http://localhost:5000/api/vehicles/myvehicles', headers)
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
    return () => {
      cancelled = true;
    };
  }, [headers]);

  const requestBooking = async ({ garageId, serviceId }) => {
    setError('');
    setMessage('');

    if (!selectedVehicleId) {
      setError('Please add/select a vehicle first.');
      return;
    }

    try {
      await axios.post(
        'http://localhost:5000/api/bookings',
        {
          garageId,
          serviceId,
          vehicleId: selectedVehicleId,
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
          notes
        },
        headers
      );

      setMessage('Booking requested. The garage will respond soon.');
    } catch (e) {
      setError(e.response?.data?.msg || 'Failed to request booking');
    }
  };

  const filteredGarages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return garages;
    return garages.filter(g =>
      (g.name || '').toLowerCase().includes(q) ||
      (g.city || '').toLowerCase().includes(q) ||
      (g.address || '').toLowerCase().includes(q)
    );
  }, [garages, searchQuery]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Garage Marketplace</h1>
        <p className="text-slate-500 font-medium mt-1">Choose a garage service and request a booking</p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by garage name or location…"
          className="w-full pl-11 pr-10 py-3 border border-slate-200 rounded-2xl bg-white text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
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

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold text-slate-900">{g.name}</div>
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
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-bold hover:bg-blue-100 transition-all"
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

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {(g.services || []).length === 0 ? (
                <div className="text-slate-500 text-sm">No services listed.</div>
              ) : (
                g.services.map((s) => (
                  <div key={s.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">{s.title}</div>
                        {s.description ? <div className="text-sm text-slate-600 mt-1">{s.description}</div> : null}
                        <div className="text-xs text-slate-500 mt-2">
                          {s.price !== null && s.price !== undefined ? `₹${s.price}` : 'Price: —'}
                          {s.durationMins ? ` • ${s.durationMins} mins` : ''}
                        </div>
                      </div>

                      <button
                        onClick={() => requestBooking({ garageId: g.id, serviceId: s.id })}
                        disabled={vehicles.length === 0}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Request
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
  );
};

export default Marketplace;
