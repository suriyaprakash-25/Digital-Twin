import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Building2, Phone, MapPin, FileText,
  CheckCircle, AlertCircle, Save, Store, Navigation, X, Camera
} from 'lucide-react';
import GarageLocationPicker from '../components/GarageLocationPicker';

const Field = ({ label, icon, children }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
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

  const [profile, setProfile] = useState({ name: '', phone: '', address: '', city: '', description: '' });
  const [original, setOriginal] = useState(null);
  const [garageLocation, setGarageLocation] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    axios.get('http://localhost:5000/api/garages/me', headers)
      .then(res => {
        if (res.data?.exists) {
          const p = {
            name: res.data.name || '',
            phone: res.data.phone || '',
            address: res.data.address || '',
            city: res.data.city || '',
            description: res.data.description || ''
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
    try {
      const res = await axios.post('http://localhost:5000/api/garages/photo', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setPhotoUrl(res.data.photoUrl);
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
      await axios.post('http://localhost:5000/api/garages/me', profile, headers);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16 animate-in fade-in duration-500">
      {/* Back */}
      <button
        onClick={() => navigate('/garage-dashboard')}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-6 group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      {/* Hero banner */}
      <div className="relative rounded-3xl overflow-hidden mb-8 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.25),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.15),transparent_60%)]" />
        <div className="relative z-10 flex items-center gap-6">
          {/* Avatar with photo upload */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
              {photoUrl
                ? <img src={photoUrl} alt="Garage" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white text-2xl font-black">{initials}</div>
              }
            </div>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
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
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold tracking-wide border border-blue-500/30 mb-2">
              <Store className="h-3.5 w-3.5" /> Garage Partner
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {profile.name || 'Your Garage'}
            </h1>
            {profile.city && (
              <p className="text-slate-400 mt-1 flex items-center gap-1.5 text-sm font-medium">
                <Navigation className="h-3.5 w-3.5" /> {profile.city}
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
      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <div className="p-2 bg-blue-100 rounded-xl text-blue-600"><Building2 className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Garage Information</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">This info appears in the marketplace listing</p>
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Garage Name" icon={<Building2 className="h-4 w-4 text-slate-400" />}>
            <input
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Sharma Auto Works"
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </Field>

          <Field label="Phone Number" icon={<Phone className="h-4 w-4 text-slate-400" />}>
            <input
              value={profile.phone}
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              placeholder="e.g. 9876543210"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </Field>

          <Field label="City" icon={<MapPin className="h-4 w-4 text-slate-400" />}>
            <input
              value={profile.city}
              onChange={e => setProfile(p => ({ ...p, city: e.target.value }))}
              placeholder="e.g. Bengaluru"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </Field>

          <Field label="Full Address" icon={<MapPin className="h-4 w-4 text-slate-400" />}>
            <input
              value={profile.address}
              onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
              placeholder="Street, Area, Landmark"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="About Your Garage" icon={<FileText className="h-4 w-4 text-slate-400" />}>
              <textarea
                value={profile.description}
                onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
                placeholder="Tell customers what makes your garage special — specialisations, certifications, experience..."
                rows={4}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
              />
            </Field>
          </div>
        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-medium">
            {isDirty ? 'You have unsaved changes' : 'All changes saved'}
          </p>
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>

      {/* Location picker card */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mt-6">
        <div className="px-8 py-5 flex items-center justify-between bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-600"><MapPin className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Garage Location</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {garageLocation
                  ? `Pinned: ${garageLocation.latitude.toFixed(5)}, ${garageLocation.longitude.toFixed(5)}`
                  : 'No location set yet'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {garageLocation && !showLocationPicker && (
              <a
                href={`https://www.google.com/maps?q=${garageLocation.latitude},${garageLocation.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-all"
              >
                <Navigation className="h-3.5 w-3.5" /> View on Maps
              </a>
            )}
            {showLocationPicker ? (
              <button
                type="button"
                onClick={() => setShowLocationPicker(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
              >
                <X className="h-3.5 w-3.5" /> Close Map
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowLocationPicker(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-sm"
              >
                <MapPin className="h-4 w-4" />
                {garageLocation ? 'Edit Location' : 'Add Garage Location'}
              </button>
            )}
          </div>
        </div>

        {showLocationPicker && (
          <div className="p-6">
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
    </div>
  );
};

export default GarageProfile;
