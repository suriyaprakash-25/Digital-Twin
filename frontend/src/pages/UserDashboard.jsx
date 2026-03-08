import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const UserDashboard = () => {
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');

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
      try {
        const [vRes, bRes, nRes] = await Promise.all([
          axios.get('http://localhost:5000/api/vehicles/myvehicles', headers),
          axios.get('http://localhost:5000/api/bookings/my', headers),
          axios.get('http://localhost:5000/api/notifications?limit=20', headers)
        ]);

        if (cancelled) return;
        setVehicles(Array.isArray(vRes.data) ? vRes.data : []);
        setBookings(Array.isArray(bRes.data) ? bRes.data : []);
        setNotifications(Array.isArray(nRes.data) ? nRes.data : []);
      } catch (e) {
        if (cancelled) return;
        setError(e.response?.data?.msg || 'Failed to load dashboard');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [headers]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">User Dashboard</h1>
          <p className="text-slate-500 font-medium mt-1">Track bookings and notifications</p>
        </div>

        <Link
          to="/marketplace"
          className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          Book a Garage Service
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">Your Vehicles</h2>
            <Link to="/my-vehicles" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
              View
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {vehicles.length === 0 ? (
              <div className="text-slate-500 text-sm">No vehicles yet. Add one to book services.</div>
            ) : (
              vehicles.slice(0, 5).map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-sm font-semibold text-slate-900">{v.vehicleNumber}</div>
                  <div className="text-xs font-medium text-slate-500">{[v.brand, v.model].filter(Boolean).join(' ')}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">Recent Notifications</h2>
          </div>
          <div className="mt-4 space-y-2">
            {notifications.length === 0 ? (
              <div className="text-slate-500 text-sm">No notifications yet.</div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <div key={n.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                  <div className="text-sm text-slate-600 mt-0.5">{n.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">Your Bookings</h2>
        </div>

        <div className="mt-4 space-y-3">
          {bookings.length === 0 ? (
            <div className="text-slate-500 text-sm">No bookings yet.</div>
          ) : (
            bookings.slice(0, 20).map((b) => (
              <div key={b.id} className="p-4 rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-slate-900">
                    {b.service?.title || 'Service'} • {b.garage?.name || 'Garage'}
                  </div>
                  <div className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700">
                    {b.status}
                  </div>
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Vehicle: <span className="font-semibold">{b.vehicle?.vehicleNumber || '—'}</span>
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Scheduled: <span className="font-semibold">{b.scheduledFor ? new Date(b.scheduledFor).toLocaleString() : 'Not set'}</span>
                </div>
                {b.notes ? <div className="text-sm text-slate-600 mt-2">Notes: {b.notes}</div> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
