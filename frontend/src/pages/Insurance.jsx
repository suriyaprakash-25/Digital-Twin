import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, FileText, Upload, Calendar, ArrowLeft, Building2, Plus, Info, AlertCircle, FileUp, Sparkles, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '../utils/config';

const Insurance = () => {
  const { vehicleId } = useParams();
  const [policies, setPolicies] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // Form State
  const [provider, setProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { headers: { Authorization: `Bearer ${token}` } };

  const fetchInsuranceData = async () => {
    try {
      const [vRes, iRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/vehicles/myvehicles`, headers),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/insurance/${vehicleId}`, headers)
      ]);
      const currentVehicle = vRes.data.find(v => v.id === vehicleId);
      setVehicle(currentVehicle);
      setPolicies(iRes.data);
    } catch (err) {
      console.error('Error fetching insurance details:', err);
      setStatus({ type: 'error', message: 'Failed to load vehicle or insurance details.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsuranceData();
  }, [vehicleId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setStatus({ type: '', message: '' });
    } else {
      setSelectedFile(null);
      setStatus({ type: 'error', message: 'Please select a valid PDF document.' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!provider || !policyNumber || !startDate || !expiryDate) {
      setStatus({ type: 'error', message: 'All text fields are required.' });
      return;
    }

    if (!selectedFile) {
      setStatus({ type: 'error', message: 'Please upload the policy PDF document.' });
      return;
    }

    if (expiryDate <= startDate) {
      setStatus({ type: 'error', message: 'Policy expiry date must be after start date.' });
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('vehicleId', vehicleId);
    formData.append('provider', provider);
    formData.append('policyNumber', policyNumber);
    formData.append('startDate', startDate);
    formData.append('expiryDate', expiryDate);
    formData.append('document', selectedFile);

    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/insurance/add`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setStatus({ type: 'success', message: 'Insurance policy logged successfully!' });
      // Reset form
      setProvider('');
      setPolicyNumber('');
      setStartDate('');
      setExpiryDate('');
      setSelectedFile(null);
      
      // Refresh list
      fetchInsuranceData();
    } catch (err) {
      console.error('Error adding policy:', err);
      setStatus({ type: 'error', message: err.response?.data?.msg || 'Failed to upload insurance policy.' });
    } finally {
      setSubmitting(false);
    }
  };

  const getPolicyStatus = (expiryDate) => {
    const today = new Date().toISOString().split('T')[0];
    if (expiryDate < today) return { label: 'Expired', color: 'text-red-600 bg-red-50 border-red-100' };
    
    // Check if expiring in less than 30 days
    const expDate = new Date(expiryDate);
    const difference = expDate - new Date();
    const daysLeft = Math.ceil(difference / (1000 * 60 * 60 * 24));
    if (daysLeft <= 30) return { label: `Expiring in ${daysLeft} days`, color: 'text-amber-600 bg-amber-50 border-amber-100' };
    
    return { label: 'Active', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 pb-24 lg:pb-8">
      <Link
        to="/my-vehicles"
        className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-teal-600 mb-6 transition-colors bg-white px-4 py-2 border border-slate-200 rounded-xl shadow-sm hover:shadow-md"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Fleet
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-teal-600" />
          Insurance Management
        </h1>
        {vehicle && (
          <p className="text-slate-500 mt-2 font-medium text-lg">
            Manage policies for {vehicle.brand} {vehicle.model} • <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-sm text-slate-700">{vehicle.vehicleNumber}</span>
          </p>
        )}
      </header>

      {status.message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold mb-6 shadow-sm ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {status.type === 'success' ? <ShieldCheck className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {status.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Form: Add Insurance */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Plus className="h-5 w-5 text-teal-600" /> Add New Policy
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Insurance Provider</label>
              <input
                type="text"
                placeholder="e.g. HDFC Ergo, ICICI Lombard"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                required
                className="block w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Policy Number</label>
              <input
                type="text"
                placeholder="Enter Policy Reference ID"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                required
                className="block w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="block w-full px-3 py-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm font-medium text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expiry Date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                  className="block w-full px-3 py-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm font-medium text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Upload Policy PDF</label>
              <div className="border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-2xl p-4 bg-slate-50 hover:bg-white transition-all text-center relative group cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  required
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <FileUp className="h-8 w-8 text-slate-400 group-hover:text-teal-600 transition-colors" />
                  <span className="text-sm font-bold text-slate-650 truncate max-w-full">
                    {selectedFile ? selectedFile.name : 'Choose PDF document'}
                  </span>
                  <span className="text-xs text-slate-400">PDF up to 10MB</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {submitting ? 'Uploading PDF...' : <><Upload className="h-4.5 w-4.5" /> Save Policy</>}
            </button>
          </form>
        </div>

        {/* Right timeline: Policies History */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" /> Coverage History
          </h2>

          {policies.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-sm">
              <ShieldCheck className="h-12 w-12 text-slate-350 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">No Policies Logged</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                No active or previous insurance coverage policies have been registered for this vehicle twin.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {policies.map((policy) => {
                const statusInfo = getPolicyStatus(policy.expiryDate);
                return (
                  <div
                    key={policy._id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-teal-100"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-slate-400 shrink-0" /> {policy.provider}
                        </span>
                        <span className={`px-2.5 py-0.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-450 font-bold tracking-wider">
                        POLICY: <span className="text-slate-700 font-mono">{policy.policyNumber}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>Period: {new Date(policy.startDate).toLocaleDateString()} to {new Date(policy.expiryDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <a
                      href={`${API_BASE_URL}${policy.documentUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 w-full sm:w-auto"
                    >
                      <FileText className="h-4 w-4" />
                      View Policy PDF
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Insurance;
