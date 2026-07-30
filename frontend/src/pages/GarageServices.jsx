import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Plus, Wrench, IndianRupee, Clock, Trash2,
  CheckCircle, AlertCircle, PackageOpen, Tag, Pencil, Image as ImageIcon, Check, ListChecks, Filter, Layers
} from 'lucide-react';

const empty = {
  title: '', description: '', price: '', durationMins: '',
  category: 'Periodic Maintenance', photoUrl: '', whatsIncluded: [], bundledItems: [], isPackage: false
};

const GarageServices = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState(empty);
  const [editingService, setEditingService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [newInclusion, setNewInclusion] = useState('');
  const [newBundleItem, setNewBundleItem] = useState('');

  const flash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const load = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/me/services`, headers);
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
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/me/services`, newService, headers);
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

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/me/services/${editingService.id}`, editingService, headers);
      setEditingService(null);
      flash('success', 'Service updated successfully!');
      await load();
    } catch (err) {
      flash('error', err.response?.data?.msg || 'Failed to update service.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this service?')) return;
    setDeleting(id);
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/me/services/${id}`, headers);
      flash('success', 'Service removed.');
      setServices(s => s.filter(x => x.id !== id));
    } catch (err) {
      flash('error', err.response?.data?.msg || 'Failed to delete service.');
    } finally {
      setDeleting(null);
    }
  };

  const categoryColors = [
    'from-teal-500 to-teal-600',
    'from-emerald-500 to-emerald-600',
    'from-violet-500 to-violet-600',
    'from-amber-500 to-amber-600',
    'from-rose-500 to-rose-600',
    'from-cyan-500 to-cyan-600',
  ];

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500 pb-12 lg:pb-8">
      {/* Back */}
      <button
        onClick={() => navigate('/garage-dashboard')}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-6 group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Your Services &amp; Packages</h1>
          <p className="text-slate-500 font-medium mt-1 text-xs md:text-sm">
            {services.length} service{services.length !== 1 ? 's' : ''} listed in the marketplace
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 px-3.5 py-2 md:px-5 md:py-3 rounded-xl bg-teal-600 text-white text-xs md:text-sm font-bold hover:bg-teal-700 transition-all shadow-md hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          Add Service / Package
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-6 text-xs font-bold no-scrollbar">
        {['ALL', 'Periodic Maintenance', 'Repairs', 'Packages & Bundles', 'Breakdown & Inspection', 'Accessories & Detailing'].map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap border ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat === 'ALL' ? 'All Services' : cat}
          </button>
        ))}
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
          className="bg-white border border-teal-100 rounded-2xl md:rounded-3xl shadow-md overflow-hidden mb-8"
        >
          <div className="px-4 py-3 md:px-8 md:py-5 bg-teal-50 border-b border-teal-100 flex items-center gap-3">
            <div className="p-1.5 bg-teal-100 rounded-xl text-teal-600"><Wrench className="h-4 w-4 md:h-5 md:w-5" /></div>
            <div>
              <h2 className="text-sm md:text-base font-extrabold text-slate-900">New Service</h2>
              <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">This will be shown to customers in the marketplace</p>
            </div>
          </div>
          <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
            <div className="space-y-1.5">
              <label className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-slate-400" /> Service Title *
              </label>
              <input
                value={newService.title}
                onChange={e => setNewService(s => ({ ...s, title: e.target.value }))}
                placeholder="e.g. Full Car Service"
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2">
                <Wrench className="h-3.5 w-3.5 text-slate-400" /> Description
              </label>
              <input
                value={newService.description}
                onChange={e => setNewService(s => ({ ...s, description: e.target.value }))}
                placeholder="What's included?"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2">
                <IndianRupee className="h-3.5 w-3.5 text-slate-400" /> Price (₹)
              </label>
              <input
                type="number"
                min="0"
                value={newService.price}
                onChange={e => setNewService(s => ({ ...s, price: e.target.value }))}
                placeholder="e.g. 2500"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-slate-400" /> Category
              </label>
              <select
                value={newService.category}
                onChange={e => setNewService(s => ({ ...s, category: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-slate-900"
              >
                <option value="Periodic Maintenance">Periodic Maintenance</option>
                <option value="Repairs">Repairs</option>
                <option value="Packages & Bundles">Packages &amp; Bundles</option>
                <option value="Breakdown & Inspection">Breakdown &amp; Inspection</option>
                <option value="Accessories & Detailing">Accessories &amp; Detailing</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5 text-slate-400" /> Service Photo URL
              </label>
              <input
                value={newService.photoUrl || ''}
                onChange={e => setNewService(s => ({ ...s, photoUrl: e.target.value }))}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              />
            </div>

            {/* What's Included Bullet List */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2">
                <ListChecks className="h-3.5 w-3.5 text-teal-600" /> &quot;What&apos;s Included&quot; Bullet List
              </label>
              <div className="space-y-2">
                {newService.whatsIncluded?.map((inc, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200">
                    <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-teal-600" /> {inc}</span>
                    <button
                      type="button"
                      onClick={() => setNewService(s => ({ ...s, whatsIncluded: s.whatsIncluded.filter((_, i) => i !== idx) }))}
                      className="text-red-500 hover:text-red-700 font-bold"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    value={newInclusion}
                    onChange={e => setNewInclusion(e.target.value)}
                    placeholder="Add item (e.g. Synthetic Oil, 25-Point Inspection)"
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newInclusion.trim()) {
                          setNewService(s => ({ ...s, whatsIncluded: [...(s.whatsIncluded || []), newInclusion.trim()] }));
                          setNewInclusion('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newInclusion.trim()) {
                        setNewService(s => ({ ...s, whatsIncluded: [...(s.whatsIncluded || []), newInclusion.trim()] }));
                        setNewInclusion('');
                      }
                    }}
                    className="px-3.5 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-900 transition-colors"
                  >
                    + Add Item
                  </button>
                </div>
              </div>
            </div>

            {/* Package Bundling Option */}
            <div className="md:col-span-2 space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(newService.isPackage)}
                  onChange={e => setNewService(s => ({ ...s, isPackage: e.target.checked, category: e.target.checked ? 'Packages & Bundles' : s.category }))}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-violet-600" /> Bundle sub-items into a service package (e.g. Basic Service = Oil + Filter + Inspection)
                </span>
              </label>
            </div>
          </div>
          <div className="px-4 py-3 md:px-8 md:py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewService(empty); }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs md:text-sm font-semibold hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 rounded-xl bg-teal-600 text-white text-xs md:text-sm font-bold hover:bg-teal-700 disabled:opacity-50 transition-all"
            >
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
              {adding ? 'Adding…' : 'Add Service'}
            </button>
          </div>
        </form>
      )}

      {/* Services grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-teal-600" />
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
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-all"
          >
            <Plus className="h-4 w-4" /> Add First Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {services
            .filter(s => selectedCategory === 'ALL' || s.category === selectedCategory || (selectedCategory === 'Packages & Bundles' && s.isPackage))
            .map((s, i) => (
            <div
              key={s.id}
              className="group bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-teal-200 transition-all overflow-hidden flex flex-col"
            >
              {/* Photo preview or Colour accent bar */}
              {s.photoUrl ? (
                <div className="h-36 w-full overflow-hidden bg-slate-100 relative">
                  <img src={s.photoUrl} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <span className="absolute top-2 right-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-900/80 text-white backdrop-blur-sm">
                    {s.category || 'General'}
                  </span>
                </div>
              ) : (
                <div className={`h-2 bg-gradient-to-r ${categoryColors[i % categoryColors.length]}`} />
              )}

              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 mb-1 inline-block">
                      {s.category || 'General Service'}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 leading-tight">{s.title}</h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => setEditingService({ ...s })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all"
                      title="Edit service"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                      title="Remove service"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {s.description && (
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{s.description}</p>
                )}

                {/* What's Included Bullet List */}
                {s.whatsIncluded && s.whatsIncluded.length > 0 && (
                  <div className="my-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">What&apos;s Included</span>
                    {s.whatsIncluded.map((inc, idx) => (
                      <div key={idx} className="text-xs text-slate-700 flex items-center gap-1.5 font-medium">
                        <Check className="h-3 w-3 text-teal-600 flex-shrink-0" />
                        <span>{inc}</span>
                      </div>
                    ))}
                  </div>
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

      {/* Edit service modal */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-teal-100 rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full animate-in zoom-in-95 duration-200">
            <div className="px-8 py-5 bg-teal-50 border-b border-teal-100 flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-xl text-teal-600">
                <Pencil className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">Edit Service</h2>
                <p className="text-xs text-slate-500 mt-0.5">Update the details of your service</p>
              </div>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="p-8 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Tag className="h-4 w-4 text-slate-400" /> Service Title *
                  </label>
                  <input
                    value={editingService.title}
                    onChange={e => setEditingService(s => ({ ...s, title: e.target.value }))}
                    placeholder="e.g. Full Car Service"
                    required
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-slate-400" /> Description
                  </label>
                  <input
                    value={editingService.description || ''}
                    onChange={e => setEditingService(s => ({ ...s, description: e.target.value }))}
                    placeholder="What's included?"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <IndianRupee className="h-4 w-4 text-slate-400" /> Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingService.price || ''}
                      onChange={e => setEditingService(s => ({ ...s, price: e.target.value }))}
                      placeholder="e.g. 2500"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" /> Duration (mins)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingService.durationMins || ''}
                      onChange={e => setEditingService(s => ({ ...s, durationMins: e.target.value }))}
                      placeholder="e.g. 120"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                    />
                  </div>
                </div>
              </div>
              <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50 transition-all"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GarageServices;
