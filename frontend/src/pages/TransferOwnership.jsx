import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, UserPlus, Mail, AlertTriangle, ShieldCheck, Info } from 'lucide-react';

const TransferOwnership = () => {
  const { vehicleId } = useParams();
  const [buyerEmail, setBuyerEmail] = useState('');
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const headers = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        const vRes = await axios.get('http://localhost:5000/api/vehicles/myvehicles', headers);
        const currentVehicle = vRes.data.find(v => v.id === vehicleId);
        setVehicle(currentVehicle);
      } catch (err) {
        console.error('Error fetching vehicle details:', err);
        setStatus({ type: 'error', message: 'Failed to load vehicle details.' });
      } finally {
        setLoading(false);
      }
    };
    fetchVehicle();
  }, [vehicleId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!buyerEmail) {
      setStatus({ type: 'error', message: 'Buyer email address is required.' });
      return;
    }

    setSubmitting(true);

    try {
      await axios.post('http://localhost:5000/api/ownership/transfer', {
        vehicleId,
        buyerEmail: buyerEmail.trim().toLowerCase()
      }, headers);

      setStatus({
        type: 'success',
        message: 'Ownership transfer request initiated successfully! Redirecting...'
      });
      setBuyerEmail('');

      setTimeout(() => {
        navigate('/my-vehicles');
      }, 2000);
    } catch (err) {
      console.error('Error initiating transfer:', err);
      setStatus({ type: 'error', message: err.response?.data?.msg || 'Failed to initiate transfer request.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <Link
        to="/my-vehicles"
        className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-teal-600 mb-6 transition-colors bg-white px-4 py-2 border border-slate-200 rounded-xl shadow-sm hover:shadow-md"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Fleet
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <UserPlus className="h-8 w-8 text-teal-600" />
          Transfer Ownership
        </h1>
        {vehicle && (
          <p className="text-slate-500 mt-2 font-medium text-lg">
            Transfer digital twin of {vehicle.brand} {vehicle.model} • <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-sm text-slate-700">{vehicle.vehicleNumber}</span>
          </p>
        )}
      </header>

      {status.message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold mb-6 shadow-sm ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {status.type === 'success' ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          {status.message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="bg-amber-50 border border-amber-150 rounded-2xl p-5 mb-6 flex gap-3 text-amber-800 text-sm font-semibold">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5 leading-relaxed">
            <h4 className="font-bold text-base text-amber-950">Important Notice</h4>
            <p>
              Initiating a transfer does not immediately move the vehicle. The designated buyer must log into their Driveportz account and **Accept** the transfer request.
            </p>
            <p className="text-xs text-amber-700">
              Once accepted, you will lose writing access to this vehicle's digital twin, and ownership history is logged permanently.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Buyer Email Address</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-500 transition-colors">
                <Mail className="h-5 w-5" />
              </div>
              <input
                type="email"
                placeholder="buyer@example.com"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                required
                className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium hover:border-slate-300 shadow-sm"
              />
            </div>
            <p className="text-xs text-slate-450 font-medium">
              The buyer must be registered on Driveportz with this exact email address.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Info className="h-4 w-4 text-teal-500 shrink-0" />
              Verification triggers on buyer accept.
            </div>
            
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-900 hover:bg-teal-600 hover:text-white text-white font-bold rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 text-sm"
            >
              {submitting ? 'Initiating Transfer...' : 'Initiate Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferOwnership;
