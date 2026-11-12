import { getPhotoUrl } from '../utils/imageUrl';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, IndianRupee, Clock, Trash2, PackageOpen, Pencil, Check } from 'lucide-react';
import { useToast } from '../context/toastContextCore';
import { apiDelete, apiGet, apiPost, apiPut, getErrorMessage } from '../utils/api';
import ErrorState from '../components/common/ErrorState';
import NewServiceForm from '../components/garage/NewServiceForm';
import EditServiceModal from '../components/garage/EditServiceModal';

const empty = {
  title: '', description: '', price: '', durationMins: '',
  category: 'Periodic Maintenance', photoUrl: '', whatsIncluded: [], bundledItems: [], isPackage: false
};

const GarageServices = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [newService, setNewService] = useState(empty);
  const [editingService, setEditingService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loadError, setLoadError] = useState(null);
  const { showToast } = useToast();
  const flash = (type, text) => {
    showToast(text, type);
  };

  const load = useCallback(async () => {
    try {
      const data = await apiGet('/garages/me/services');
      setServices(Array.isArray(data) ? data : []);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load your services.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) load(); });
    return () => { cancelled = true; };
  }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    try {
      await apiPost('/garages/me/services', newService);
      setNewService(empty);
      setShowForm(false);
      flash('success', 'Service added successfully!');
      await load();
    } catch (err) {
      flash('error', getErrorMessage(err, 'Failed to add service.'));
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await apiPut(`/garages/me/services/${editingService.id}`, editingService);
      setEditingService(null);
      flash('success', 'Service updated successfully!');
      await load();
    } catch (err) {
      flash('error', getErrorMessage(err, 'Failed to update service.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this service?')) return;
    setDeleting(id);
    try {
      await apiDelete(`/garages/me/services/${id}`);
      flash('success', 'Service removed.');
      setServices(s => s.filter(x => x.id !== id));
    } catch (err) {
      flash('error', getErrorMessage(err, 'Failed to delete service.'));
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
        type="button"
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
          type="button"
          aria-expanded={showForm}
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
            type="button"
            aria-pressed={selectedCategory === cat}
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



      {/* Add service form */}
      {showForm && (
        <NewServiceForm
          value={newService}
          onChange={setNewService}
          onSubmit={handleAdd}
          onCancel={() => { setShowForm(false); setNewService(empty); }}
          adding={adding}
        />
      )}

      {loadError && <ErrorState className="mb-6" message={loadError} onRetry={() => { setLoading(true); load(); }} />}

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
            type="button"
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
                  <img src={getPhotoUrl(s.photoUrl)} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all">
                    <button
                      type="button"
                      onClick={() => setEditingService({ ...s })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all"
                      title="Edit service"
                      aria-label={`Edit ${s.title}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                      title="Remove service"
                      aria-label={`Remove ${s.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
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
        <EditServiceModal
          service={editingService}
          onChange={setEditingService}
          onSubmit={handleUpdate}
          onClose={() => setEditingService(null)}
          saving={saving}
        />
      )}
    </div>
  );
};

export default GarageServices;
