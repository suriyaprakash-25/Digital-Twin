import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowRight,
  Camera,
  Car,
  CheckCircle,
  FileBadge2,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Shield,
  Upload,
  User,
  Wrench
} from 'lucide-react';

const StatCard = ({ label, value, tone }) => (
  <div className={`rounded-2xl border p-3.5 sm:p-5 flex flex-col justify-between min-w-0 ${tone}`}>
    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-[0.15em] opacity-70 break-words leading-tight">{label}</p>
    <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-black tracking-tight">{value}</p>
  </div>
);

const Field = ({ label, icon, children }) => (
  <div className="space-y-2">
    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
      {icon}
      {label}
    </label>
    {children}
  </div>
);

const MyProfile = () => {
  const token = localStorage.getItem('token');
  const fileInputRef = useRef(null);
  const licenseInputRef = useRef(null);
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', city: '', bio: '', role: 'USER', photoUrl: null, licenseDocumentUrl: null, createdAt: null });
  const [original, setOriginal] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [photoError, setPhotoError] = useState(false);

  const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [profileRes, vehiclesRes, bookingsRes] = await Promise.all([
          axios.get('http://localhost:5000/api/auth/me', headers),
          axios.get('http://localhost:5000/api/vehicles/myvehicles', headers),
          axios.get('http://localhost:5000/api/bookings/my', headers)
        ]);

        if (cancelled) return;
        const nextProfile = profileRes.data;
        setProfile(nextProfile);
        setOriginal(nextProfile);
        setPhotoError(false);
        setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
        setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
      } catch (err) {
        if (cancelled) return;
        setMessage({ type: 'error', text: err.response?.data?.msg || 'Failed to load profile.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [headers]);

  const initials = profile.name
    ? profile.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const activeBookings = bookings.filter((booking) => ['REQUESTED', 'PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(String(booking.status || '').toUpperCase())).length;
  const completedBookings = bookings.filter((booking) => String(booking.status || '').toUpperCase() === 'COMPLETED').length;
  const isDirty = original && JSON.stringify({
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    city: profile.city,
    bio: profile.bio
  }) !== JSON.stringify({
    name: original.name,
    email: original.email,
    phone: original.phone,
    city: original.city,
    bio: original.bio
  });

  const persistUser = (nextUser) => {
    const userRaw = localStorage.getItem('user');
    const prevUser = userRaw ? JSON.parse(userRaw) : {};
    localStorage.setItem('user', JSON.stringify({ ...prevUser, ...nextUser }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await axios.put('http://localhost:5000/api/auth/me', {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        city: profile.city,
        bio: profile.bio
      }, headers);

      setProfile((prev) => ({ ...prev, ...res.data.user }));
      setOriginal((prev) => ({ ...prev, ...res.data.user }));
      persistUser(res.data.user);
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.msg || 'Failed to save profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);
    setUploading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await axios.post('http://localhost:5000/api/auth/me/photo', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setProfile((prev) => ({ ...prev, photoUrl: res.data.photoUrl }));
      setOriginal((prev) => ({ ...prev, photoUrl: res.data.photoUrl }));
      setPhotoError(false);
      persistUser({ photoUrl: res.data.photoUrl });
      setMessage({ type: 'success', text: 'Profile photo updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.msg || 'Failed to upload photo.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLicenseUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('license', file);
    setUploadingLicense(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await axios.post('http://localhost:5000/api/auth/me/license', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setProfile((prev) => ({ ...prev, licenseDocumentUrl: res.data.licenseDocumentUrl }));
      setOriginal((prev) => ({ ...prev, licenseDocumentUrl: res.data.licenseDocumentUrl }));
      persistUser({ licenseDocumentUrl: res.data.licenseDocumentUrl });
      setMessage({ type: 'success', text: 'License uploaded successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.msg || 'Failed to upload license.' });
    } finally {
      setUploadingLicense(false);
      if (licenseInputRef.current) licenseInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-b-4 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-14 animate-in fade-in duration-500 space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_28%)]" />
        <div className="relative z-10 p-6 sm:p-8 md:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="relative shrink-0">
                <div className="h-24 w-24 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg flex items-center justify-center">
                  {profile.photoUrl && !photoError ? (
                    <img 
                      src={profile.photoUrl} 
                      alt="Profile" 
                      className="h-full w-full object-cover" 
                      onError={() => setPhotoError(true)}
                    />
                  ) : (
                    <div className="text-3xl font-black text-white">{initials}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-2 -right-2 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white text-slate-900 shadow-md transition hover:bg-slate-100 disabled:opacity-60"
                  title="Upload profile photo"
                >
                  {uploading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" /> : <Camera className="h-4 w-4" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-teal-200">
                  <Shield className="h-3.5 w-3.5" /> {profile.role === 'GARAGE' ? 'Garage Partner' : 'Member Profile'}
                </div>
                <h1 className="mt-3 text-4xl font-black tracking-tight">{profile.name || 'Your Profile'}</h1>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" /> {profile.email}</span>
                  {profile.city ? <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> {profile.city}</span> : null}
                  <span className="inline-flex items-center gap-2"><User className="h-4 w-4" /> Joined {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Recently'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full lg:w-auto">
              <StatCard label="Vehicles" value={vehicles.length} tone="border-white/10 bg-white/5 text-white" />
              <StatCard label="Open Bookings" value={activeBookings} tone="border-white/10 bg-white/5 text-white" />
              <StatCard label="Completed" value={completedBookings} tone="border-white/10 bg-white/5 text-white" />
            </div>
          </div>
        </div>
      </section>

      {message.text ? (
        <div className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5" />
            {message.text}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.3fr_0.7fr]">
        <form onSubmit={handleSave} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-8 py-5">
            <h2 className="text-xl font-black tracking-tight text-slate-900">Profile Details</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Keep your contact details current so service updates and bookings stay reliable.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 p-8 md:grid-cols-2">
            <Field label="Full Name" icon={<User className="h-4 w-4 text-slate-400" />}>
              <input value={profile.name} onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20" />
            </Field>

            <Field label="Email Address" icon={<Mail className="h-4 w-4 text-slate-400" />}>
              <input type="email" value={profile.email} onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20" />
            </Field>

            <Field label="Phone Number" icon={<Phone className="h-4 w-4 text-slate-400" />}>
              <input value={profile.phone} onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))} placeholder="e.g. 9876543210" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20" />
            </Field>

            <Field label="City" icon={<MapPin className="h-4 w-4 text-slate-400" />}>
              <input value={profile.city} onChange={(e) => setProfile((prev) => ({ ...prev, city: e.target.value }))} placeholder="Your city" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20" />
            </Field>

            <div className="md:col-span-2">
              <Field label="About You" icon={<PencilLine className="h-4 w-4 text-slate-400" />}>
                <textarea value={profile.bio} onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))} rows={5} placeholder="Tell us a little about your driving habits, vehicle interests, or what you use Driveportz for." className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20" />
              </Field>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 sm:px-8 py-5">
            <p className="text-xs font-semibold text-slate-400">{isDirty ? 'You have unsaved changes' : 'Profile is up to date'}</p>
            <button type="submit" disabled={saving} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Account Snapshot</h3>
            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Role</p>
                <p className="mt-1 text-base font-bold text-slate-900">{profile.role === 'GARAGE' ? 'Garage Partner' : 'Vehicle Owner'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Driving License</p>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      {profile.licenseDocumentUrl ? 'Document uploaded' : 'No license uploaded yet'}
                    </p>
                  </div>
                  <FileBadge2 className="h-5 w-5 text-teal-500" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => licenseInputRef.current?.click()}
                    disabled={uploadingLicense}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-60"
                  >
                    {uploadingLicense ? 'Uploading...' : 'Upload License'}
                    <Upload className="h-3.5 w-3.5" />
                  </button>
                  {profile.licenseDocumentUrl ? (
                    <a
                      href={profile.licenseDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-700 transition hover:bg-teal-100"
                    >
                      View License
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
                <input
                  ref={licenseInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={handleLicenseUpload}
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Quick Actions</h3>
            <div className="mt-5 space-y-3">
              <Link to="/add-vehicle" className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700">
                <span className="inline-flex items-center gap-3"><Car className="h-4 w-4" /> Register another vehicle</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/marketplace" className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
                <span className="inline-flex items-center gap-3"><Wrench className="h-4 w-4" /> Browse garage marketplace</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;