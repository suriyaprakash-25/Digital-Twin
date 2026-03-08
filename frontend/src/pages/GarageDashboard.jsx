import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'garage' || r === 'service_center' || r === 'servicecenter' || r === 'service center') return 'GARAGE';
  if (r === 'vehicle_owner' || r === 'vehicle owner' || r === 'user' || r === 'customer' || r === 'owner') return 'USER';
  return role || 'USER';
}

const GarageDashboard = () => {
  const token = localStorage.getItem('token');
  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  const role = normalizeRole(user?.role);

  const [profile, setProfile] = useState({ name: '', phone: '', address: '', city: '', description: '' });
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [newService, setNewService] = useState({ title: '', description: '', price: '', durationMins: '' });

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const headers = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`
      }
    }),
    [token]
  );

  async function loadAll() {
    setError('');
    setMessage('');

    try {
      const [pRes, sRes, bRes, nRes] = await Promise.all([
        axios.get('http://localhost:5000/api/garages/me', headers),
        axios.get('http://localhost:5000/api/garages/me/services', headers).catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/bookings/garage', headers).catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/notifications?limit=20', headers)
      ]);

      if (pRes.data && pRes.data.exists) {
        setProfile({
          name: pRes.data.name || '',
          phone: pRes.data.phone || '',
          address: pRes.data.address || '',
          city: pRes.data.city || '',
          description: pRes.data.description || ''
        });
      }

      setServices(Array.isArray(sRes.data) ? sRes.data : []);
      setBookings(Array.isArray(bRes.data) ? bRes.data : []);
      setNotifications(Array.isArray(nRes.data) ? nRes.data : []);
    } catch (e) {
      setError(e.response?.data?.msg || 'Failed to load garage dashboard');
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await axios.post('http://localhost:5000/api/garages/me', profile, headers);
      setMessage('Garage profile saved');
      await loadAll();
    } catch (e2) {
      setError(e2.response?.data?.msg || 'Failed to save profile');
    }
  };

  const addService = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await axios.post('http://localhost:5000/api/garages/me/services', newService, headers);
      setNewService({ title: '', description: '', price: '', durationMins: '' });
      setMessage('Service created');
      await loadAll();
    } catch (e2) {
      setError(e2.response?.data?.msg || 'Failed to create service');
    }
  };

  const updateBookingStatus = async (bookingId, status) => {
    setError('');
    setMessage('');

    try {
      await axios.patch(`http://localhost:5000/api/bookings/${bookingId}/status`, { status }, headers);
      setMessage('Booking updated');
      await loadAll();
    } catch (e2) {
      setError(e2.response?.data?.msg || 'Failed to update booking');
    }
  };

  if (role !== 'GARAGE') {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="text-lg font-extrabold text-slate-900">Forbidden</div>
        <div className="text-slate-600 mt-2 text-sm">This page is for Garage accounts.</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Garage Dashboard</h1>
          <p className="text-slate-500 font-medium mt-1">Manage services and booking requests</p>
        </div>

        <Link
          to="/garage-portal"
          className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors"
        >
          Service Verification Portal
        </Link>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-slate-900">Garage Profile</h2>
          <form className="mt-4 space-y-3" onSubmit={saveProfile}>
            <input
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              placeholder="Garage name"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
              required
            />
            <input
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              placeholder="Phone"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
            />
            <input
              value={profile.address}
              onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
              placeholder="Address"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
            />
            <input
              value={profile.city}
              onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
              placeholder="City"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
            />
            <input
              value={profile.description}
              onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))}
              placeholder="Description"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
            />
            <button className="w-full px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
              Save Profile
            </button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-slate-900">Recent Notifications</h2>
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
        <h2 className="text-lg font-extrabold text-slate-900">Your Services</h2>

        <form className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={addService}>
          <input
            value={newService.title}
            onChange={(e) => setNewService((s) => ({ ...s, title: e.target.value }))}
            placeholder="Title"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
            required
          />
          <input
            value={newService.description}
            onChange={(e) => setNewService((s) => ({ ...s, description: e.target.value }))}
            placeholder="Description"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
          />
          <input
            value={newService.price}
            onChange={(e) => setNewService((s) => ({ ...s, price: e.target.value }))}
            placeholder="Price"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
          />
          <input
            value={newService.durationMins}
            onChange={(e) => setNewService((s) => ({ ...s, durationMins: e.target.value }))}
            placeholder="Duration (mins)"
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
          />
          <div className="md:col-span-4">
            <button className="w-full px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
              Add Service
            </button>
          </div>
        </form>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.length === 0 ? (
            <div className="text-slate-500 text-sm">No services yet.</div>
          ) : (
            services.map((s) => (
              <div key={s.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                <div className="text-sm font-extrabold text-slate-900">{s.title}</div>
                {s.description ? <div className="text-sm text-slate-600 mt-1">{s.description}</div> : null}
                <div className="text-xs text-slate-500 mt-2">
                  {s.price !== null && s.price !== undefined ? `₹${s.price}` : 'Price: —'}
                  {s.durationMins ? ` • ${s.durationMins} mins` : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-900">Booking Requests</h2>

        <div className="mt-4 space-y-3">
          {bookings.length === 0 ? (
            <div className="text-slate-500 text-sm">No bookings yet.</div>
          ) : (
            bookings.slice(0, 30).map((b) => (
              <div key={b.id} className="p-4 rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-slate-900">
                    {b.service?.title || 'Service'} • {b.vehicle?.vehicleNumber || 'Vehicle'}
                  </div>
                  <div className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700">{b.status}</div>
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  Scheduled: <span className="font-semibold">{b.scheduledFor ? new Date(b.scheduledFor).toLocaleString() : 'Not set'}</span>
                </div>
                {b.notes ? <div className="text-sm text-slate-600 mt-2">Notes: {b.notes}</div> : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => updateBookingStatus(b.id, 'ACCEPTED')}
                    className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold hover:bg-emerald-100"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => updateBookingStatus(b.id, 'REJECTED')}
                    className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => updateBookingStatus(b.id, 'IN_PROGRESS')}
                    className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100"
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => updateBookingStatus(b.id, 'COMPLETED')}
                    className="px-3 py-2 rounded-xl bg-slate-100 text-slate-800 text-sm font-semibold hover:bg-slate-200"
                  >
                    Completed
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GarageDashboard;
