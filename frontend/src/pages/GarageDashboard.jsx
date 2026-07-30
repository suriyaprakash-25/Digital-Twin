import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Bell, Store, Wrench, Phone, MessageSquare, Filter,
  CalendarCheck, Clock, CheckCircle, XCircle, Loader2,
  TrendingUp, AlertTriangle, PlayCircle, CheckCircle2, User, Car
} from 'lucide-react';

function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'garage' || r === 'service_center' || r === 'servicecenter' || r === 'service center') return 'GARAGE';
  if (r === 'vehicle_owner' || r === 'vehicle owner' || r === 'user' || r === 'customer' || r === 'owner') return 'USER';
  return role || 'USER';
}

const statusMeta = {
  REQUESTED:   { label: 'Pending',     color: 'bg-amber-100 text-amber-700',    icon: <Clock className="h-3.5 w-3.5" /> },
  PENDING:     { label: 'Pending',     color: 'bg-amber-100 text-amber-700',    icon: <Clock className="h-3.5 w-3.5" /> },
  ACCEPTED:    { label: 'Accepted',    color: 'bg-teal-100 text-teal-700',      icon: <CheckCircle className="h-3.5 w-3.5" /> },
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

  const [inputCapacity, setInputCapacity] = useState(20);
  const [updatingCapacity, setUpdatingCapacity] = useState(false);
  const [bookingTab, setBookingTab] = useState('ALL');

  const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  useEffect(() => {
    if (profile?.maxCapacity !== undefined) {
      setInputCapacity(profile.maxCapacity);
    }
  }, [profile]);

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [pRes, sRes, bRes, nRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/me`, headers).catch(() => ({ data: { exists: false } })),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/me/services`, headers).catch(() => ({ data: [] })),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings/garage`, headers).catch(() => ({ data: [] })),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/notifications?limit=20`, headers).catch(() => ({ data: [] })),
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
  }, [headers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAll(); }, [loadAll]);

  const updateBookingStatus = async (bookingId, status) => {
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings/${bookingId}/status`, { status }, headers);
      setMessage('Booking updated');
      setTimeout(() => setMessage(''), 3000);
      await loadAll();
    } catch (e) {
      setError(e.response?.data?.msg || 'Failed to update booking');
    }
  };

  const handleUpdateCapacity = async () => {
    if (inputCapacity < 1) return;
    setUpdatingCapacity(true);
    try {
      const res = await axios.patch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/me/capacity`,
        { maxCapacity: inputCapacity },
        headers
      );
      setProfile(p => ({ ...p, maxCapacity: res.data.maxCapacity }));
      setMessage('Capacity limit updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setError(e.response?.data?.msg || 'Failed to update capacity limit');
    } finally {
      setUpdatingCapacity(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-600" />
      </div>
    );
  }

  if (role !== 'GARAGE') {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <div className="text-lg font-extrabold text-slate-900">Access Restricted</div>
        <div className="text-slate-500 mt-1 text-sm">This page is for Garage partner accounts only.</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 bg-teal-50 border border-teal-100 rounded-2xl flex items-center justify-center mx-auto">
          <Store className="h-8 w-8 text-teal-500" />
        </div>
        <div className="text-xl font-extrabold text-slate-900">Set Up Your Garage Profile</div>
        <p className="text-slate-500 text-sm max-w-sm mx-auto">
          You haven&apos;t created your garage profile yet. Set it up to start accepting bookings and managing your services.
        </p>
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}
        <Link
          to="/garage-profile"
          className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Store className="h-4 w-4" /> Create Garage Profile
        </Link>
      </div>
    );
  }

  const pendingCount = bookings.filter(b => b.status === 'PENDING' || b.status === 'REQUESTED').length;
  const inProgressCount = bookings.filter(b => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS').length;
  const completedCount = bookings.filter(b => b.status === 'COMPLETED').length;

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'G';

  return (
    <div className="space-y-8 pb-12 lg:pb-8">

      {/* Hero header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-5 sm:p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.3),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.15),transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg flex-shrink-0">
                {profile?.photoUrl
                  ? <img src={profile.photoUrl} alt="Garage" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white text-xl font-black">{initials}</div>
                }
              </div>
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold tracking-wide border border-emerald-500/30 mb-1">
                  <Store className="h-3.5 w-3.5" /> Partner Garage
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                  {profile?.name || 'Your Garage'}
                </h1>
                {profile?.city && <p className="text-slate-400 text-sm font-medium mt-0.5">{profile.city}</p>}
              </div>
            </div>

            {/* Smart Availability Button */}
            <Link
              to="/garage-availability"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold rounded-xl transition-colors border border-indigo-500/30 text-sm shadow-sm"
            >
              <Clock className="h-4 w-4" />
              Smart Availability
            </Link>
          </div>

          {/* Stats - Responsive 3-col tight row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[
              { label: 'Total Services',  value: services.length,  icon: <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-teal-400" />,        bg: 'bg-teal-500/10' },
              { label: 'In Progress',     value: inProgressCount,   icon: <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-violet-400 text-violet-400" />, bg: 'bg-violet-500/10' },
              { label: 'Completed',       value: completedCount,    icon: <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />, bg: 'bg-emerald-500/10' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-2.5 sm:p-4 text-center sm:text-left">
                <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl ${s.bg} flex items-center justify-center mx-auto sm:mx-0 mb-1.5 sm:mb-3`}>{s.icon}</div>
                <div className="text-lg sm:text-2xl font-black text-white">{s.value}</div>
                <div className="text-[10px] sm:text-xs text-slate-400 font-semibold mt-0.5 truncate">{s.label}</div>
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

      {/* Capacity & Vehicles In Progress Control Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Capacity Management Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between lg:col-span-1">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
                <Store className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Capacity & Shop Floor</h3>
                <p className="text-xs text-slate-500 font-semibold">Manage active vehicle limits</p>
              </div>
            </div>

            {/* Occupancy stats */}
            <div className="space-y-2 mt-4">
              <div className="flex justify-between text-sm font-bold text-slate-700">
                <span>Occupancy</span>
                <span>{bookings.filter(b => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS').length} / {profile?.maxCapacity !== undefined ? profile.maxCapacity : 20} slots</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    Math.min(100, Math.round((bookings.filter(b => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS').length / (profile?.maxCapacity !== undefined ? profile.maxCapacity : 20)) * 100)) >= 90 
                      ? 'bg-rose-500' 
                      : Math.min(100, Math.round((bookings.filter(b => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS').length / (profile?.maxCapacity !== undefined ? profile.maxCapacity : 20)) * 100)) >= 75 
                        ? 'bg-amber-500' 
                        : 'bg-teal-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((bookings.filter(b => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS').length / (profile?.maxCapacity !== undefined ? profile.maxCapacity : 20)) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                {(profile?.maxCapacity !== undefined ? profile.maxCapacity : 20) - bookings.filter(b => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS').length} available slots out of {profile?.maxCapacity !== undefined ? profile.maxCapacity : 20} total limit.
              </p>
            </div>
          </div>

          {/* Quick Edit Capacity Form */}
          <div className="border-t border-slate-100 pt-4 mt-6">
            <label className="block text-xs font-bold text-slate-700 mb-2">Adjust Capacity Limit</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={inputCapacity}
                onChange={(e) => setInputCapacity(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-950 bg-slate-55 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-center"
              />
              <button
                onClick={handleUpdateCapacity}
                disabled={updatingCapacity || inputCapacity === (profile?.maxCapacity !== undefined ? profile.maxCapacity : 20)}
                className="flex-1 bg-slate-900 text-white font-bold rounded-xl px-4 py-2 text-xs hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {updatingCapacity ? 'Saving…' : 'Update Limit'}
              </button>
            </div>
          </div>
        </div>        {/* Vehicles Currently in Progress Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden lg:col-span-2 flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 text-violet-650 rounded-xl">
                <Wrench className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Vehicles Currently In Progress</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Vehicles on the shop floor being serviced</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">
              {bookings.filter(b => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS').length} active
            </span>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[220px]">
            {bookings.filter(b => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS').length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                <Wrench className="h-10 w-10 text-slate-200 mb-2" />
                <p className="text-slate-400 font-medium text-xs">No vehicles currently in progress.</p>
              </div>
            ) : (
              bookings.filter(b => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS').map(b => (
                <div key={b.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">
                      {b.vehicle?.brand} {b.vehicle?.model} &bull; <span className="font-mono text-xs text-indigo-650">{b.vehicle?.vehicleNumber}</span>
                    </div>
                    <div className="text-xs text-slate-500 font-semibold mt-0.5">
                      Service: {b.service?.title} | Status: <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${b.status === 'IN_PROGRESS' ? 'bg-violet-100 text-violet-700' : 'bg-teal-100 text-teal-700'}`}>{b.status === 'IN_PROGRESS' ? 'In Progress' : 'Accepted'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {b.status === 'ACCEPTED' && (
                      <button
                        onClick={() => updateBookingStatus(b.id, 'IN_PROGRESS')}
                        className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 border border-violet-200 transition-colors"
                      >
                        Start Service
                      </button>
                    )}
                    <button
                      onClick={() => updateBookingStatus(b.id, 'COMPLETED')}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 border border-emerald-200 transition-colors"
                    >
                      Mark Completed
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Booking requests section with Filter Tabs & State-dependent Actions */}
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
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl gap-1 text-xs font-bold">
            {[
              { key: 'ALL', label: 'All' },
              { key: 'TODAY', label: 'Today' },
              { key: 'UPCOMING', label: 'Upcoming' },
              { key: 'OVERDUE', label: 'Overdue' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setBookingTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  bookingTab === tab.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {(() => {
            const todayStr = new Date().toISOString().split('T')[0];

            const filteredBookings = bookings.filter(b => {
              const bDateStr = b.scheduledFor ? new Date(b.scheduledFor).toISOString().split('T')[0] : '';
              if (bookingTab === 'TODAY') return bDateStr === todayStr;
              if (bookingTab === 'UPCOMING') return bDateStr > todayStr;
              if (bookingTab === 'OVERDUE') {
                return (b.status === 'PENDING' || b.status === 'REQUESTED') && (bDateStr < todayStr || (!bDateStr && new Date() - new Date(b.createdAt) > 86400000));
              }
              return true;
            });

            if (filteredBookings.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CalendarCheck className="h-12 w-12 text-slate-200 mb-3" />
                  <p className="text-slate-500 font-medium text-sm">No bookings found for &quot;{bookingTab.toLowerCase()}&quot; filter.</p>
                </div>
              );
            }

            return filteredBookings.map(b => {
              const meta = statusMeta[b.status] || { label: b.status, color: 'bg-slate-100 text-slate-600', icon: null };
              const cleanPhone = b.customer?.phone ? String(b.customer.phone).replace(/\D/g, '') : '';

              return (
                <div key={b.id} className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="space-y-1">
                      <div className="text-sm font-extrabold text-slate-900 flex flex-wrap items-center gap-2">
                        <span>{b.service?.title || 'General Service'}</span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="font-semibold text-slate-700">{b.vehicle?.brand} {b.vehicle?.model}</span>
                        <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded font-bold">{b.vehicle?.vehicleNumber || 'Reg: N/A'}</span>
                      </div>

                      {/* Customer Info & Tap-to-Call / WhatsApp */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1 font-medium">
                        <span className="flex items-center gap-1 font-bold text-slate-800">
                          <User className="h-3.5 w-3.5 text-teal-600" /> {b.customer?.name || 'Customer'}
                        </span>
                        {b.customer?.phone && (
                          <a
                            href={`tel:${b.customer.phone}`}
                            className="inline-flex items-center gap-1 text-teal-600 font-bold hover:underline"
                          >
                            <Phone className="h-3 w-3" /> {b.customer.phone}
                          </a>
                        )}
                        {cleanPhone && (
                          <a
                            href={`https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodeURIComponent(`Hi ${b.customer?.name || 'Customer'}, regarding your booking for ${b.service?.title || 'service'} at ${profile?.name || 'our garage'}...`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 font-bold hover:underline"
                          >
                            <MessageSquare className="h-3 w-3" /> WhatsApp
                          </a>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 font-medium pt-0.5">
                        Scheduled: <span className="font-bold text-slate-700">{b.scheduledFor ? new Date(b.scheduledFor).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set'}</span>
                      </div>
                      {b.notes && <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 max-w-lg mt-1">Notes: {b.notes}</div>}
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${meta.color}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>

                  {/* Context-aware Single Next Action Button */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100/60 mt-3">
                    {(b.status === 'PENDING' || b.status === 'REQUESTED') && (
                      <>
                        <button
                          onClick={() => updateBookingStatus(b.id, 'ACCEPTED')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-sm"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Accept Booking
                        </button>
                        <button
                          onClick={() => updateBookingStatus(b.id, 'REJECTED')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 border border-red-200 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </>
                    )}

                    {b.status === 'ACCEPTED' && (
                      <button
                        onClick={() => updateBookingStatus(b.id, 'IN_PROGRESS')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors shadow-sm"
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Start Job
                      </button>
                    )}

                    {b.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => updateBookingStatus(b.id, 'COMPLETED')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
                      </button>
                    )}

                    {(b.status === 'COMPLETED' || b.status === 'REJECTED') && (
                      <span className="text-xs font-bold text-slate-400 italic">No further action needed</span>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Notifications - Deduped Feed */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-xl text-amber-600"><Bell className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Recent Notifications</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Latest activity on your garage</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {(() => {
            // Dedupe notifications by title + body
            const seen = new Set();
            const deduped = notifications.filter(n => {
              const key = `${n.title}|${n.body}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

            if (deduped.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="h-10 w-10 text-slate-200 mb-3" />
                  <p className="text-slate-500 font-medium text-sm">No notifications yet.</p>
                </div>
              );
            }

            return deduped.slice(0, 8).map(n => (
              <div key={n.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="text-sm font-bold text-slate-900">{n.title}</div>
                {n.body && <div className="text-sm text-slate-500 mt-0.5">{n.body}</div>}
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
};

export default GarageDashboard;
