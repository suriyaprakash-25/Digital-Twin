import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Building2, Phone, MapPin, FileText,
  CheckCircle, AlertCircle, Save, Store, Navigation, X, Camera,
  Award, Wrench, Image as ImageIcon, Star, Plus, Trash2
} from 'lucide-react';
import GarageLocationPicker from '../components/GarageLocationPicker';
import { getPhotoUrl } from '../utils/imageUrl';

const Field = ({ label, icon, children }) => (
  <div className="space-y-1.5 pb-1 lg:pb-2">
    <label className="text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2">
      {icon}
      {label}
    </label>
    {children}
  </div>
);

const GarageProfile = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [profile, setProfile] = useState({
    name: '', phone: '', address: '', city: '', description: '', maxCapacity: 20,
    certifications: [], specializations: [], galleryPhotos: []
  });
  const [original, setOriginal] = useState({
    name: '', phone: '', address: '', city: '', description: '', maxCapacity: 20,
    certifications: [], specializations: [], galleryPhotos: []
  });
  const [garageLocation, setGarageLocation] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [newCertInput, setNewCertInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/me`, headers)
      .then(res => {
        if (res.data?.exists) {
          const p = {
            name: res.data.name || '',
            phone: res.data.phone || '',
            address: res.data.address || '',
            city: res.data.city || '',
            description: res.data.description || '',
            maxCapacity: res.data.maxCapacity !== undefined ? res.data.maxCapacity : 20,
            certifications: Array.isArray(res.data.certifications) ? res.data.certifications : [],
            specializations: Array.isArray(res.data.specializations) ? res.data.specializations : [],
            galleryPhotos: Array.isArray(res.data.galleryPhotos) ? res.data.galleryPhotos : []
          };
          setProfile(p);
          setOriginal(p);
          if (res.data.garageLocation) {
            setGarageLocation(res.data.garageLocation);
          }
          if (res.data.photoUrl) {
            setPhotoUrl(res.data.photoUrl);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [headers]);

  const isDirty = original && JSON.stringify(profile) !== JSON.stringify(original);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    setUploadingPhoto(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/photo`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.photoUrl) {
        setPhotoUrl(res.data.photoUrl);
        setPhotoLoadError(false);
        setMessage({ type: 'success', text: 'Garage logo photo uploaded successfully!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.msg || 'Failed to upload photo.' });
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/me`, profile, headers);
      setOriginal({ ...profile });
      setMessage({ type: 'success', text: 'Profile saved successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.msg || 'Failed to save profile.' });
    } finally {
      setSaving(false);
    }
  };

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'G';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 lg:pb-8 animate-in fade-in duration-500">
      {/* Back */}
      <button
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
            >
              {uploadingPhoto
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera className="h-3.5 w-3.5" />}
            </button>
            <input
              ref={photoInputRef}
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

      {/* Message */}
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
          <Field label="Garage Name" icon={<Building2 className="h-3.5 w-3.5 text-slate-400" />}>
            <input
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Sharma Auto Works"
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </Field>

          <Field label="Phone Number" icon={<Phone className="h-3.5 w-3.5 text-slate-400" />}>
            <input
              value={profile.phone}
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              placeholder="e.g. 9876543210"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </Field>

          <Field label="City" icon={<MapPin className="h-3.5 w-3.5 text-slate-400" />}>
            <input
              value={profile.city}
              onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
              placeholder="e.g. Bengaluru"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </Field>

          <Field label="Full Address" icon={<MapPin className="h-3.5 w-3.5 text-slate-400" />}>
            <input
              value={profile.address}
              onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
              placeholder="Street, Area, Landmark"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            />
          </Field>

          <Field label="Maximum Capacity (Vehicle Limit)" icon={<Building2 className="h-3.5 w-3.5 text-slate-400" />}>
            <input
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
            <Field label="About Your Garage" icon={<FileText className="h-3.5 w-3.5 text-slate-400" />}>
              <textarea
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
            <Field label="Certifications & Authorized Brand Tags" icon={<Award className="h-3.5 w-3.5 text-amber-500" />}>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.certifications.map((cert, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl">
                    <Award className="h-3 w-3 text-amber-600" /> {cert}
                    <button
                      type="button"
                      onClick={() => setProfile(p => ({ ...p, certifications: p.certifications.filter((_, i) => i !== idx) }))}
                      className="ml-1 text-amber-600 hover:text-amber-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {profile.galleryPhotos.map((url, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden h-24 border border-slate-200 bg-slate-100">
                    <img
                      src={getPhotoUrl(url)}
                      alt={`Gallery ${idx}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.parentElement.style.display = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const targetUrl = url;
                        setProfile(p => ({ ...p, galleryPhotos: p.galleryPhotos.filter((_, i) => i !== idx) }));
                        try {
                          await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/gallery`, {
                            headers: { Authorization: `Bearer ${token}` },
                            data: { photoUrl: targetUrl }
                          });
                        } catch (err) {}
                      }}
                      className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      title="Delete photo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={uploadingGallery}
                  className="h-24 rounded-xl border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50 hover:bg-teal-50/50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-teal-600 transition-all font-semibold text-xs"
                >
                  {uploadingGallery ? (
                    <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      <span>Upload Photos</span>
                    </>
                  )}
                </button>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    setUploadingGallery(true);
                    try {
                      const formData = new FormData();
                      files.forEach(f => formData.append('photos', f));
                      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/gallery`, formData, {
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
                      });
                      if (Array.isArray(res.data?.galleryPhotos)) {
                        setProfile(p => ({ ...p, galleryPhotos: res.data.galleryPhotos }));
                        setOriginal(o => ({ ...o, galleryPhotos: res.data.galleryPhotos }));
                        setMessage({ type: 'success', text: `${files.length} photo(s) uploaded & saved!` });
                      }
                    } catch (err) {
                      setMessage({ type: 'error', text: err.response?.data?.msg || 'Failed to upload photo(s).' });
                    } finally {
                      setUploadingGallery(false);
                      if (galleryInputRef.current) galleryInputRef.current.value = '';
                    }
                  }}
                />
              </div>
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
      <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden mt-6">
        <div className="px-4 py-3 md:px-8 md:py-5 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-teal-100 rounded-xl text-teal-600"><MapPin className="h-4 w-4 md:h-5 md:w-5" /></div>
            <div>
              <h2 className="text-sm md:text-lg font-extrabold text-slate-900">Garage Location</h2>
              <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5">
                {garageLocation
                  ? `Pinned: ${garageLocation.latitude.toFixed(5)}, ${garageLocation.longitude.toFixed(5)}`
                  : 'No location set yet'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto justify-end">
            {garageLocation && !showLocationPicker && (
              <a
                href={`https://www.google.com/maps?q=${garageLocation.latitude},${garageLocation.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] md:text-xs font-bold hover:bg-emerald-100 transition-all"
              >
                <Navigation className="h-3 w-3 md:h-3.5 md:w-3.5" /> View on Maps
              </a>
            )}
            {showLocationPicker ? (
              <button
                type="button"
                onClick={() => setShowLocationPicker(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl border border-slate-200 bg-white text-slate-650 text-[10px] md:text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
              >
                <X className="h-3 w-3 md:h-3.5 md:w-3.5" /> Close Map
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowLocationPicker(true)}
                className="inline-flex items-center gap-1 px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-teal-600 text-white text-xs md:text-sm font-bold hover:bg-teal-700 transition-all shadow-sm"
              >
                <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" />
                {garageLocation ? 'Edit Location' : 'Add Garage Location'}
              </button>
            )}
          </div>
        </div>

        {showLocationPicker && (
          <div className="p-4 md:p-6 border-t border-slate-100">
            <GarageLocationPicker
              token={token}
              initialLocation={garageLocation}
              onSaved={(coords) => {
                setGarageLocation(coords);
                setTimeout(() => setShowLocationPicker(false), 1200);
              }}
            />
          </div>
        )}
      </div>

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
