import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
        axios.get('http://localhost:5000/api/vehicles/myvehicles', headers),
        axios.get('http://localhost:5000/api/bookings/my', headers),
        axios.get('http://localhost:5000/api/notifications?limit=20', headers),
        axios.get('http://localhost:5000/api/ownership/pending', headers)
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
      await axios.post('http://localhost:5000/api/ownership/transfer/accept', { transferId }, headers);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to accept transfer.');
    }
  };

  const handleRejectTransfer = async (transferId) => {
    setError('');
    try {
      await axios.post('http://localhost:5000/api/ownership/transfer/reject', { transferId }, headers);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to reject transfer.');
    }
  };

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {pendingTransfers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-extrabold text-amber-900 flex items-center gap-2">
            ⚠️ Pending Ownership Transfers
          </h2>
          <div className="space-y-3">
            {pendingTransfers.map((transfer) => (
              <div key={transfer.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-2xl bg-white border border-amber-200 gap-4">
                <div>
                  <div className="font-extrabold text-slate-900">
                    {transfer.vehicle ? `${transfer.vehicle.brand} ${transfer.vehicle.model}` : 'Unknown Vehicle'}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{transfer.vehicle?.vehicleNumber}</div>
                  <div className="text-sm text-slate-600 mt-2">
                    Transfer request from: <span className="font-semibold text-slate-800">{transfer.sellerName}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleAcceptTransfer(transfer.id)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-755 text-white rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-102"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectTransfer(transfer.id)}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-102"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">User Dashboard</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm sm:text-base">Track bookings and notifications</p>
        </div>

        <Link
          to="/marketplace"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors w-full sm:w-auto"
        >
          Book a Garage Service
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">Your Vehicles</h2>
            <Link to="/my-vehicles" className="text-sm font-semibold text-teal-600 hover:text-teal-700">
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
                  <div className="text-xs font-bold px-3 py-1 rounded-full bg-teal-50 text-teal-700">
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
