import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, Phone, MapPin, FileText,
  Save, Store, Navigation, X, Camera,
  Award, Wrench, Image as ImageIcon, Star, Plus
} from 'lucide-react';
import GalleryManager from '../components/garage/GalleryManager';
import GarageLocationCard from '../components/garage/GarageLocationCard';
import ErrorState from '../components/common/ErrorState';
import { getPhotoUrl } from '../utils/imageUrl';
import { useToast } from '../context/toastContextCore';
import { apiGet, apiPost, apiUpload, getErrorMessage } from '../utils/api';

/** Labelled form row. Pass `htmlFor` when the child is a single input with that id. */
const Field = ({ label, icon, htmlFor, children }) => {
  const LabelTag = htmlFor ? 'label' : 'span';
  return (
    <div className="space-y-1.5 pb-1 lg:pb-2">
      <LabelTag htmlFor={htmlFor} className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2">
        {icon}
        {label}
      </LabelTag>
      {children}
    </div>
  );
};

const GarageProfile = () => {
  const navigate = useNavigate();
  const fieldId = useId();

  const [profile, setProfile] = useState({
    name: '', phone: '', address: '', city: '', description: '', maxCapacity: 20,
    certifications: [], specializations: [], galleryPhotos: []
  });
  const [original, setOriginal] = useState({
    name: '', phone: '', address: '', city: '', description: '', maxCapacity: 20,
    certifications: [], specializations: [], galleryPhotos: []
  });
  const [garageLocation, setGarageLocation] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  const [newCertInput, setNewCertInput] = useState('');
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/garages/me');
      setLoadError(null);
      if (data?.exists) {
        const p = {
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          city: data.city || '',
          description: data.description || '',
          maxCapacity: data.maxCapacity !== undefined ? data.maxCapacity : 20,
          certifications: Array.isArray(data.certifications) ? data.certifications : [],
          specializations: Array.isArray(data.specializations) ? data.specializations : [],
          galleryPhotos: Array.isArray(data.galleryPhotos) ? data.galleryPhotos : []
        };
        setProfile(p);
        setOriginal(p);
        if (data.garageLocation) {
          setGarageLocation(data.garageLocation);
        }
        if (data.photoUrl) {
          setPhotoUrl(data.photoUrl);
        }
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load your garage profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) loadProfile(); });
    return () => { cancelled = true; };
  }, [loadProfile]);

  const isDirty = original && JSON.stringify(profile) !== JSON.stringify(original);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    setUploadingPhoto(true);
    try {
      const data = await apiUpload('/garages/photo', formData);
      if (data?.photoUrl) {
        setPhotoUrl(data.photoUrl);
        setPhotoLoadError(false);
        showToast('Garage logo photo uploaded successfully!', 'success');
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to upload photo.'), 'error');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await apiPost('/garages/me', profile);
      setOriginal({ ...profile });
      showToast('Profile saved successfully!', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to save profile.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'G';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32" role="status" aria-label="Loading garage profile">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-600" />
      </div>
    );
  }

  if (loadError) {
    return <div className="max-w-4xl mx-auto"><ErrorState message={loadError} onRetry={loadProfile} /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 lg:pb-8 animate-in fade-in duration-500">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/garage-dashboard')}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-6 group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      {/* Hero banner */}
      <div className="relative rounded-2xl md:rounded-3xl overflow-hidden mb-4 md:mb-8 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 p-4 md:p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.25),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.15),transparent_60%)]" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center text-center sm:text-left gap-4 md:gap-6">
          {/* Avatar with photo upload */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
              {photoUrl && !photoLoadError ? (
                <img
                  src={getPhotoUrl(photoUrl)}
                  alt="Garage"
                  className="w-full h-full object-cover"
                  onError={() => setPhotoLoadError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white text-2xl font-black">{initials}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-teal-500 hover:bg-teal-600 text-white rounded-lg flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
              title="Upload garage photo"
              aria-label="Upload garage photo"
            >
              {uploadingPhoto
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera className="h-3.5 w-3.5" />}
            </button>
            <input
              ref={photoInputRef}
              aria-label="Garage photo file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 md:px-3 md:py-1 bg-teal-500/20 text-teal-300 rounded-full text-[10px] md:text-xs font-bold tracking-wide border border-teal-500/30 mb-1.5">
              <Store className="h-3 w-3 md:h-3.5 md:w-3.5" /> Garage Partner
            </div>
            <h1 className="text-xl md:text-3xl font-extrabold text-white tracking-tight">
              {profile.name || 'Your Garage'}
            </h1>
            {profile.city && (
              <p className="text-slate-400 mt-1 flex items-center justify-center sm:justify-start gap-1.5 text-xs md:text-sm font-medium">
                <Navigation className="h-3 w-3 md:h-3.5 md:w-3.5" /> {profile.city}
              </p>
            )}
          </div>
        </div>
      </div>



      {/* Form card */}
      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 md:px-8 md:py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <div className="p-1.5 bg-teal-100 rounded-xl text-teal-600"><Building2 className="h-4 w-4 md:h-5 md:w-5" /></div>
          <div>
            <h2 className="text-sm md:text-lg font-extrabold text-slate-900">Garage Information</h2>
            <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5">This info appears in the marketplace listing</p>
          </div>
        </div>

        <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
          <Field label="Garage Name" htmlFor={`${fieldId}-name`} icon={<Building2 className="h-3.5 w-3.5 text-slate-400" />}>
            <input
              id={`${fieldId}-name`}
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Sharma Auto Works"
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </Field>

          <Field label="Phone Number" htmlFor={`${fieldId}-phone`} icon={<Phone className="h-3.5 w-3.5 text-slate-400" />}>
            <input
              id={`${fieldId}-phone`}
              type="tel"
              value={profile.phone}
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              placeholder="e.g. 9876543210"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </Field>

          <Field label="City" htmlFor={`${fieldId}-city`} icon={<MapPin className="h-3.5 w-3.5 text-slate-400" />}>
            <input
              id={`${fieldId}-city`}
              value={profile.city}
              onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
              placeholder="e.g. Bengaluru"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </Field>

          <Field label="Full Address" htmlFor={`${fieldId}-address`} icon={<MapPin className="h-3.5 w-3.5 text-slate-400" />}>
            <input
              id={`${fieldId}-address`}
              value={profile.address}
              onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
              placeholder="Street, Area, Landmark"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </Field>

          <Field label="Maximum Capacity (Vehicle Limit)" htmlFor={`${fieldId}-capacity`} icon={<Building2 className="h-3.5 w-3.5 text-slate-400" />}>
            <input
              id={`${fieldId}-capacity`}
              type="number"
              value={profile.maxCapacity}
              onChange={e => setProfile(p => ({ ...p, maxCapacity: Math.max(1, parseInt(e.target.value, 10) || 0) }))}
              placeholder="e.g. 20"
              required
              min="1"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="About Your Garage" htmlFor={`${fieldId}-description`} icon={<FileText className="h-3.5 w-3.5 text-slate-400" />}>
              <textarea
                id={`${fieldId}-description`}
                value={profile.description}
                onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
                placeholder="Tell customers what makes your garage special — specialisations, certifications, experience..."
                rows={4}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all resize-none"
              />
            </Field>
          </div>

          {/* Authorized Certifications */}
          <div className="md:col-span-2 space-y-2">
            <Field label="Certifications & Authorized Brand Tags" htmlFor={`${fieldId}-cert`} icon={<Award className="h-3.5 w-3.5 text-amber-500" />}>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.certifications.map((cert, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl">
                    <Award className="h-3 w-3 text-amber-600" /> {cert}
                    <button
                      type="button"
                      onClick={() => setProfile(p => ({ ...p, certifications: p.certifications.filter((_, i) => i !== idx) }))}
                      className="ml-1 text-amber-600 hover:text-amber-900"
                      aria-label={`Remove certification ${cert}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  id={`${fieldId}-cert`}
                  value={newCertInput}
                  onChange={e => setNewCertInput(e.target.value)}
                  placeholder="Add e.g. Maruti Authorized, Bosch Certified..."
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs md:text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newCertInput.trim()) {
                        setProfile(p => ({ ...p, certifications: [...p.certifications, newCertInput.trim()] }));
                        setNewCertInput('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newCertInput.trim()) {
                      setProfile(p => ({ ...p, certifications: [...p.certifications, newCertInput.trim()] }));
                      setNewCertInput('');
                    }
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </Field>
          </div>

          {/* Specialization Chips */}
          <div className="md:col-span-2 space-y-2">
            <Field label="Garage Specializations" icon={<Wrench className="h-3.5 w-3.5 text-teal-500" />}>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  'AC Repair', 'EV Service', 'Denting & Painting', 'Engine Overhaul',
                  'Battery & Electrical', 'Suspension & Steering', 'Brake Systems',
                  'Periodic Maintenance', 'Transmission Repair', 'Custom Mods'
                ].map(spec => {
                  const isSelected = profile.specializations.includes(spec);
                  return (
                    <button
                      key={spec}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setProfile(p => ({
                          ...p,
                          specializations: isSelected
                            ? p.specializations.filter(s => s !== spec)
                            : [...p.specializations, spec]
                        }));
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        isSelected
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}{spec}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          {/* Shop Photo Gallery */}
          <div className="md:col-span-2 space-y-3 pt-2">
            <Field label="Shop Photos (Exterior / Interior / Equipment)" icon={<ImageIcon className="h-3.5 w-3.5 text-indigo-500" />}>
              <GalleryManager
                photos={profile.galleryPhotos}
                onChange={(photos, { persisted }) => {
                  setProfile(p => ({ ...p, galleryPhotos: photos }));
                  if (persisted) setOriginal(o => ({ ...o, galleryPhotos: photos }));
                }}
              />
            </Field>
          </div>

        </div>

        <div className="px-4 py-3 md:px-8 md:py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-[10px] md:text-xs text-slate-400 font-medium">
            {isDirty ? 'You have unsaved changes' : 'All changes saved'}
          </p>
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="inline-flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 rounded-xl bg-teal-600 text-white text-xs md:text-sm font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            <Save className="h-3.5 w-3.5 md:h-4 md:w-4" />
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>

      {/* Location picker card */}
      <GarageLocationCard location={garageLocation} onLocationSaved={setGarageLocation} />

      {/* Ratings & Reviews Pre-launch Card */}
      <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm p-6 mt-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><Star className="h-5 w-5 fill-amber-400" /></div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Ratings &amp; Reviews</h3>
            <p className="text-xs text-slate-500 font-medium">Customer reviews displayed on your public profile</p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 font-bold rounded-full text-xs border border-amber-200 mb-2">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> 4.8 Rating (Pre-launch verified)
          </div>
          <p className="text-xs text-slate-500 font-medium">No customer reviews yet. Ratings will automatically generate as completed booking reviews come in.</p>
        </div>
      </div>
    </div>
  );
};

export default GarageProfile;
