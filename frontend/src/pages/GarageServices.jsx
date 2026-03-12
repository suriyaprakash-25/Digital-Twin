import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Plus, Wrench, IndianRupee, Clock, Trash2,
  CheckCircle, AlertCircle, PackageOpen, Tag
} from 'lucide-react';

const empty = { title: '', description: '', price: '', durationMins: '' };

const GarageServices = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showForm, setShowForm] = useState(false);

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const load = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/garages/me/services', headers);
      setServices(Array.isArray(res.data) ? res.data : []);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [headers]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await axios.post('http://localhost:5000/api/garages/me/services', newService, headers);
      setNewService(empty);
      setShowForm(false);
      flash('success', 'Service added successfully!');
      await load();
    } catch (err) {
      flash('error', err.response?.data?.msg || 'Failed to add service.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this service?')) return;
    setDeleting(id);
    try {
      await axios.delete(`http://localhost:5000/api/garages/me/services/${id}`, headers);
      flash('success', 'Service removed.');
      setServices(s => s.filter(x => x.id !== id));
    } catch (err) {
      flash('error', err.response?.data?.msg || 'Failed to delete service.');
    } finally {
      setDeleting(null);
    }
  };

  const categoryColors = [
    'from-blue-500 to-blue-600',
    'from-emerald-500 to-emerald-600',
    'from-violet-500 to-violet-600',
    'from-amber-500 to-amber-600',
    'from-rose-500 to-rose-600',
    'from-cyan-500 to-cyan-600',
  ];

  return (
    <div className="max-w-5xl mx-auto pb-16 animate-in fade-in duration-500">
      {/* Back */}
      <button
        onClick={() => navigate('/garage-dashboard')}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-6 group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Your Services</h1>
          <p className="text-slate-500 font-medium mt-1">
            {services.length} service{services.length !== 1 ? 's' : ''} listed in the marketplace
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Add Service
        </button>
      </div>

      {/* Flash message */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 text-sm font-semibold ${
          message.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.type === 'success'
            ? <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            : <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Add service form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white border border-blue-100 rounded-3xl shadow-md overflow-hidden mb-8"
        >
          <div className="px-8 py-5 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-600"><Wrench className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">New Service</h2>
              <p className="text-xs text-slate-500 mt-0.5">This will be shown to customers in the marketplace</p>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-400" /> Service Title *
              </label>
              <input
                value={newService.title}
                onChange={e => setNewService(s => ({ ...s, title: e.target.value }))}
                placeholder="e.g. Full Car Service"
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-slate-400" /> Description
              </label>
              <input
                value={newService.description}
                onChange={e => setNewService(s => ({ ...s, description: e.target.value }))}
                placeholder="What's included?"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-slate-400" /> Price (₹)
              </label>
              <input
                type="number"
                min="0"
                value={newService.price}
                onChange={e => setNewService(s => ({ ...s, price: e.target.value }))}
                placeholder="e.g. 2500"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" /> Duration (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={newService.durationMins}
                onChange={e => setNewService(s => ({ ...s, durationMins: e.target.value }))}
                placeholder="e.g. 120"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewService(empty); }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
            >
              <Plus className="h-4 w-4" />
              {adding ? 'Adding…' : 'Add Service'}
            </button>
          </div>
        </form>
      )}

      {/* Services grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600" />
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-slate-200 rounded-3xl text-center">
          <PackageOpen className="h-14 w-14 text-slate-300 mb-4" />
          <h3 className="text-lg font-extrabold text-slate-800 mb-1">No services yet</h3>
          <p className="text-slate-500 text-sm max-w-xs">
            Add your first service to appear in the marketplace and accept bookings from customers.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-blue-700 transition-all"
          >
            <Plus className="h-4 w-4" /> Add First Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {services.map((s, i) => (
            <div
              key={s.id}
              className="group bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all overflow-hidden flex flex-col"
            >
              {/* Colour accent bar */}
              <div className={`h-1.5 bg-gradient-to-r ${categoryColors[i % categoryColors.length]}`} />

              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${categoryColors[i % categoryColors.length]} text-white shadow-sm`}>
                    <Wrench className="h-4 w-4" />
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                    title="Remove service"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 mb-1 leading-tight">{s.title}</h3>
                {s.description && (
                  <p className="text-sm text-slate-500 leading-relaxed flex-1">{s.description}</p>
                )}

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-4">
                  {s.price !== null && s.price !== undefined && s.price !== '' ? (
                    <span className="flex items-center gap-1 text-sm font-extrabold text-slate-900">
                      <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                      {Number(s.price).toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400 font-medium">Price on request</span>
                  )}
                  {s.durationMins && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                      <Clock className="h-3 w-3" /> {s.durationMins} min
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GarageServices;
