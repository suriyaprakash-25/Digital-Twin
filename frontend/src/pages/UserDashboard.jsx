import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Bell, CheckCircle2, XCircle, Info, ChevronRight, Activity, CalendarClock } from 'lucide-react';
import axios from 'axios';

const UserDashboard = () => {
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
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

  const loadData = async () => {
    try {
      const [vRes, bRes, nRes, pRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/vehicles/myvehicles`, headers),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/bookings/my`, headers),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/notifications?limit=20`, headers),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ownership/pending`, headers)
      ]);
      setVehicles(Array.isArray(vRes.data) ? vRes.data : []);
      setBookings(Array.isArray(bRes.data) ? bRes.data : []);
      setNotifications(Array.isArray(nRes.data) ? nRes.data : []);
      setPendingTransfers(Array.isArray(pRes.data) ? pRes.data : []);
    } catch (e) {
      setError(e.response?.data?.msg || 'Failed to load dashboard');
    }
  };

  useEffect(() => {
    setError('');
    loadData();
  }, [headers]);

  const handleAcceptTransfer = async (transferId) => {
    setError('');
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ownership/transfer/accept`, { transferId }, headers);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to accept transfer.');
    }
  };

  const handleRejectTransfer = async (transferId) => {
    setError('');
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ownership/transfer/reject`, { transferId }, headers);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to reject transfer.');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-12 lg:pb-8">
      {pendingTransfers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm md:text-lg font-extrabold text-amber-900 flex items-center gap-2">
            ⚠️ Pending Ownership Transfers
          </h2>
          <div className="space-y-2">
            {pendingTransfers.map((transfer) => (
              <div key={transfer.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 md:p-4 rounded-xl md:rounded-2xl bg-white border border-amber-200 gap-3">
                <div>
                  <div className="font-extrabold text-sm md:text-base text-slate-900">
                    {transfer.vehicle ? `${transfer.vehicle.brand} ${transfer.vehicle.model}` : 'Unknown Vehicle'}
                  </div>
                  <div className="text-[10px] md:text-xs text-slate-500 font-mono mt-0.5">{transfer.vehicle?.vehicleNumber}</div>
                  <div className="text-xs md:text-sm text-slate-600 mt-1 md:mt-2">
                    Transfer request from: <span className="font-semibold text-slate-800">{transfer.sellerName}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleAcceptTransfer(transfer.id)}
                    className="px-3.5 py-2 md:px-4 md:py-2.5 bg-emerald-600 hover:bg-emerald-755 text-white rounded-xl text-[10px] md:text-xs font-bold shadow-sm transition-all hover:scale-102"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectTransfer(transfer.id)}
                    className="px-3.5 py-2 md:px-4 md:py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] md:text-xs font-bold shadow-sm transition-all hover:scale-102"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 tracking-tight">User Dashboard</h1>
          <p className="text-slate-500 font-medium mt-0.5 text-xs md:text-sm">Track bookings and notifications</p>
        </div>

        <Link
          to="/marketplace"
          className="inline-flex items-center justify-center px-3.5 py-2 md:px-4 md:py-2.5 rounded-xl bg-teal-600 text-white text-xs md:text-sm font-semibold hover:bg-teal-700 transition-colors w-full sm:w-auto"
        >
          Book a Garage Service
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-xs md:text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        {/* Vehicles Section */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-sm relative overflow-hidden group">
          <div className="relative z-10 flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-base md:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Car className="w-4 h-4 md:w-5 md:h-5 text-teal-600" />
              Your Vehicles
            </h2>
            <Link to="/my-vehicles" className="text-[10px] md:text-xs font-bold text-teal-600 hover:text-teal-800 uppercase tracking-wider flex items-center gap-1 transition-colors">
              View All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="relative z-10 space-y-2">
            {vehicles.length === 0 ? (
              <div className="text-slate-400 text-xs md:text-sm py-4">No vehicles yet. Add one to book services.</div>
            ) : (
              vehicles.slice(0, 5).map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer group/card">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-teal-50 flex items-center justify-center border border-teal-100">
                      <Car className="w-4 h-4 md:w-5 md:h-5 text-teal-600 group-hover/card:scale-110 transition-transform" />
                    </div>
                    <div>
                      <div className="text-xs md:text-sm font-bold text-slate-900 tracking-wide">{v.vehicleNumber}</div>
                      <div className="text-[10px] md:text-xs font-medium text-slate-600 mt-0.5">{[v.brand, v.model].filter(Boolean).join(' ')}</div>
                    </div>
                  </div>
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notifications Section */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-base md:text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 md:w-5 md:h-5 text-teal-600" />
              Recent Activity
            </h2>
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-teal-50 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 md:w-4 md:h-4 text-teal-600" />
            </div>
          </div>
          
          <div className="space-y-2 max-h-[380px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 pr-2">
            {notifications.length === 0 ? (
              <div className="text-slate-500 text-xs md:text-sm py-8 text-center flex flex-col items-center justify-center">
                <Bell className="w-7 h-7 md:w-8 md:h-8 text-slate-300 mb-2" />
                No recent notifications
              </div>
            ) : (
              notifications.slice(0, 10).map((n) => {
                const isAccepted = n.body.includes('ACCEPTED');
                const isRejected = n.body.includes('REJECTED');
                const isCompleted = n.body.includes('COMPLETED');
                
                let Icon = Info;
                let iconColor = 'text-blue-500';
                let iconBg = 'bg-blue-50 border-blue-100';
                
                if (isAccepted || isCompleted) {
                  Icon = CheckCircle2;
                  iconColor = 'text-emerald-600';
                  iconBg = 'bg-emerald-50 border-emerald-100';
                } else if (isRejected) {
                  Icon = XCircle;
                  iconColor = 'text-rose-600';
                  iconBg = 'bg-rose-50 border-rose-100';
                }

                return (
                  <div key={n.id} className="flex gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all duration-300 group cursor-default">
                    <div className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border ${iconBg}`}>
                      <Icon className={`w-4 h-4 md:w-5 md:h-5 ${iconColor} group-hover:scale-110 transition-transform`} />
                    </div>
                    <div>
                      <div className="text-xs md:text-sm font-bold text-slate-900">{n.title}</div>
                      <div className="text-xs md:text-sm text-slate-655 mt-1 leading-snug">{n.body}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-extrabold text-slate-900">Your Bookings</h2>
        </div>

        <div className="mt-3 md:mt-4 space-y-2 md:space-y-3 max-h-[380px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 pr-2">
          {bookings.length === 0 ? (
            <div className="text-slate-500 text-xs md:text-sm py-8 text-center flex flex-col items-center justify-center">
              <CalendarClock className="w-7 h-7 md:w-8 md:h-8 text-slate-300 mb-2" />
              No bookings yet.
            </div>
          ) : (
            bookings.slice(0, 20).map((b) => (
              <div key={b.id} className="p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50 hover:bg-white hover:shadow-md transition-all duration-300 cursor-default group">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs md:text-sm font-extrabold text-slate-900 group-hover:text-teal-700 transition-colors">
                    {b.service?.title || 'Service'} • {b.garage?.name || 'Garage'}
                  </div>
                  <div className="text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-100 shadow-sm">
                    {b.status}
                  </div>
                </div>
                <div className="text-xs md:text-sm text-slate-655 mt-1.5 flex items-center gap-2">
                  <span className="text-slate-400">Vehicle:</span>
                  <span className="font-bold text-slate-800">{b.vehicle?.vehicleNumber || '—'}</span>
                </div>
                <div className="text-xs md:text-sm text-slate-655 mt-0.5 flex items-center gap-2">
                  <span className="text-slate-400">Scheduled:</span>
                  <span className="font-semibold">{b.scheduledFor ? new Date(b.scheduledFor).toLocaleString() : 'Not set'}</span>
                </div>
                {b.notes ? <div className="text-xs md:text-sm text-slate-500 mt-2 bg-white/50 p-2 rounded-lg border border-slate-100 italic">"{b.notes}"</div> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
