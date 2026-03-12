import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Bell, Store, Wrench,
  CalendarCheck, Clock, CheckCircle, XCircle, Loader2,
  TrendingUp, AlertTriangle
} from 'lucide-react';

function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'garage' || r === 'service_center' || r === 'servicecenter' || r === 'service center') return 'GARAGE';
  if (r === 'vehicle_owner' || r === 'vehicle owner' || r === 'user' || r === 'customer' || r === 'owner') return 'USER';
  return role || 'USER';
}

const statusMeta = {
  PENDING:     { label: 'Pending',     color: 'bg-amber-100 text-amber-700',    icon: <Clock className="h-3.5 w-3.5" /> },
  ACCEPTED:    { label: 'Accepted',    color: 'bg-blue-100 text-blue-700',      icon: <CheckCircle className="h-3.5 w-3.5" /> },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-violet-100 text-violet-700',  icon: <Loader2 className="h-3.5 w-3.5" /> },
  COMPLETED:   { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700',icon: <CheckCircle className="h-3.5 w-3.5" /> },
  REJECTED:    { label: 'Rejected',    color: 'bg-red-100 text-red-700',        icon: <XCircle className="h-3.5 w-3.5" /> },
};

const GarageDashboard = () => {
  const token = localStorage.getItem('token');
  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  const role = normalizeRole(user?.role);

  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  async function loadAll() {
    setError('');
    try {
      const [pRes, sRes, bRes, nRes] = await Promise.all([
        axios.get('http://localhost:5000/api/garages/me', headers),
        axios.get('http://localhost:5000/api/garages/me/services', headers).catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/bookings/garage', headers).catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/notifications?limit=20', headers).catch(() => ({ data: [] })),
      ]);
      setProfile(pRes.data?.exists ? pRes.data : null);
      setServices(Array.isArray(sRes.data) ? sRes.data : []);
      setBookings(Array.isArray(bRes.data) ? bRes.data : []);
      setNotifications(Array.isArray(nRes.data) ? nRes.data : []);
    } catch (e) {
      setError(e.response?.data?.msg || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [headers]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateBookingStatus = async (bookingId, status) => {
    try {
      await axios.patch(`http://localhost:5000/api/bookings/${bookingId}/status`, { status }, headers);
      setMessage('Booking updated');
      setTimeout(() => setMessage(''), 3000);
      await loadAll();
    } catch (e) {
      setError(e.response?.data?.msg || 'Failed to update booking');
    }
  };

  if (role !== 'GARAGE') {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <div className="text-lg font-extrabold text-slate-900">Access Restricted</div>
        <div className="text-slate-500 mt-1 text-sm">This page is for Garage partner accounts only.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600" />
      </div>
    );
  }

  const pendingCount = bookings.filter(b => b.status === 'PENDING').length;
  const inProgressCount = bookings.filter(b => b.status === 'IN_PROGRESS').length;
  const completedCount = bookings.filter(b => b.status === 'COMPLETED').length;

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'G';

  return (
    <div className="space-y-8 pb-12">

      {/* Hero header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.3),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.15),transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                {profile?.photoUrl
                  ? <img src={profile.photoUrl} alt="Garage" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-xl font-black">{initials}</div>
                }
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold tracking-wide border border-emerald-500/30 mb-1">
                  <Store className="h-3.5 w-3.5" /> Partner Garage
                </div>
                <h1 className="text-2xl font-extrabold text-white">
                  {profile?.name || 'Your Garage'}
                </h1>
                {profile?.city && <p className="text-slate-400 text-sm font-medium mt-0.5">{profile.city}</p>}
              </div>
            </div>

          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Services',  value: services.length,  icon: <Wrench className="h-5 w-5 text-blue-400" />,        bg: 'bg-blue-500/10' },
              { label: 'Pending',         value: pendingCount,      icon: <Clock className="h-5 w-5 text-amber-400" />,        bg: 'bg-amber-500/10' },
              { label: 'In Progress',     value: inProgressCount,   icon: <Loader2 className="h-5 w-5 text-violet-400" />,     bg: 'bg-violet-500/10' },
              { label: 'Completed',       value: completedCount,    icon: <TrendingUp className="h-5 w-5 text-emerald-400" />, bg: 'bg-emerald-500/10' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>{s.icon}</div>
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-xs text-slate-400 font-semibold mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-sm font-medium flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> {message}
        </div>
      )}

      {/* Booking requests */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-600"><CalendarCheck className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Booking Requests</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{bookings.length} total bookings</p>
            </div>
          </div>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
              <Clock className="h-3 w-3" /> {pendingCount} pending
            </span>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarCheck className="h-12 w-12 text-slate-200 mb-3" />
              <p className="text-slate-500 font-medium text-sm">No bookings yet.</p>
            </div>
          ) : (
            bookings.slice(0, 20).map(b => {
              const meta = statusMeta[b.status] || { label: b.status, color: 'bg-slate-100 text-slate-600', icon: null };
              return (
                <div key={b.id} className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">
                        {b.service?.title || 'Service'} &nbsp;&bull;&nbsp;
                        <span className="font-semibold text-slate-600">{b.vehicle?.vehicleNumber || 'Vehicle'}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-medium">
                        Scheduled: {b.scheduledFor ? new Date(b.scheduledFor).toLocaleString() : 'Not set'}
                      </div>
                      {b.notes && <div className="text-xs text-slate-400 mt-1">Notes: {b.notes}</div>}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${meta.color}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => updateBookingStatus(b.id, 'ACCEPTED')}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors">Accept</button>
                    <button onClick={() => updateBookingStatus(b.id, 'IN_PROGRESS')}
                      className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 transition-colors">In Progress</button>
                    <button onClick={() => updateBookingStatus(b.id, 'COMPLETED')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors">Completed</button>
                    <button onClick={() => updateBookingStatus(b.id, 'REJECTED')}
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors">Reject</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-xl text-amber-600"><Bell className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Recent Notifications</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Latest activity on your garage</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-slate-500 font-medium text-sm">No notifications yet.</p>
            </div>
          ) : (
            notifications.slice(0, 8).map(n => (
              <div key={n.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="text-sm font-bold text-slate-900">{n.title}</div>
                {n.body && <div className="text-sm text-slate-500 mt-0.5">{n.body}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GarageDashboard;
