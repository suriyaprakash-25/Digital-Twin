import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Car, User, ShieldCheck, History, Calendar,
  Building2, Wrench, Download, QrCode, AlertCircle,
  Activity, Sparkles, Phone, Mail, Award
} from 'lucide-react';
import { API_BASE_URL } from '../utils/config';

const Passport = () => {
  const { vehicleId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPassport = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/passport/${vehicleId}`);
        setData(res.data);
      } catch (err) {
        console.error('Error fetching passport:', err);
        setError(err.response?.data?.msg || 'Failed to load vehicle passport');
      } finally {
        setLoading(false);
      }
    };
    fetchPassport();
  }, [vehicleId]);

  const handleDownloadQR = () => {
    if (!data?.vehicle?.qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = data.vehicle.qrCodeUrl;
    link.download = `qrcode_${data.vehicle.vehicleNumber || 'passport'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-600"></div>
          <span className="text-sm font-semibold text-slate-500">Retrieving digital passport...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">Access Error</h3>
          <p className="text-slate-500 text-sm mb-6">{error || 'This passport link is invalid or the vehicle no longer exists.'}</p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
          >
            Go to Landing Page
          </Link>
        </div>
      </div>
    );
  }

  const { vehicle, owner, healthScore, services, ownershipHistory, partsReplaced } = data;

  const findReplacedPart = (keywords) => {
    return partsReplaced?.find(p => 
      keywords.some(kw => p.partName?.toLowerCase().includes(kw))
    );
  };

  const battery = findReplacedPart(['battery']);
  const brakePads = findReplacedPart(['brake pad', 'brakepad', 'brakes', 'brake pads']);
  const airFilter = findReplacedPart(['air filter', 'airfilter', 'filter']);

  // Determine condition level based on score
  let conditionText = 'Excellent';
  let conditionColor = 'text-emerald-600 bg-emerald-50 border-emerald-100'; // Green
  if (healthScore < 50) {
    conditionText = 'Poor';
    conditionColor = 'text-red-600 bg-red-50 border-red-100'; // Red
  } else if (healthScore < 70) {
    conditionText = 'Average';
    conditionColor = 'text-amber-600 bg-amber-50 border-amber-100'; // Orange
  } else if (healthScore < 85) {
    conditionText = 'Good';
    conditionColor = 'text-blue-600 bg-blue-50 border-blue-100'; // Blue
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Decorative Blobs */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal-50 rounded-full blur-[100px] opacity-60 pointer-events-none transform translate-x-1/3 -translate-y-1/3 z-0" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-50 rounded-full blur-[100px] opacity-60 pointer-events-none transform -translate-x-1/3 translate-y-1/3 z-0" />

      {/* Top Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-removebg-preview.png" alt="Driveportz" className="h-9 w-9 rounded-xl object-cover shadow-md" />
            <span className="font-extrabold text-slate-900 text-lg tracking-tight">Drive<span className="text-teal-600">portz</span></span>
          </Link>
          <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-100 flex items-center gap-1.5 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Official Digital Twin
          </span>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 relative z-10">
        
        {/* Passport Title */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <Award className="h-9 w-9 text-teal-600" />
              Vehicle Passport
            </h1>
            <p className="text-slate-500 mt-1.5 font-medium text-sm sm:text-base">
              Verified blockchain-grade digital footprint & telemetry twin for {vehicle.brand} {vehicle.model}.
            </p>
          </div>
          <a
            href={`${API_BASE_URL}/api/passport/pdf/${vehicleId}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all self-start sm:self-center shrink-0"
          >
            <Download className="h-4.5 w-4.5" />
            Download PDF Passport
          </a>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Columns (Vehicle Details & Timeline) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Section 1: Vehicle Information */}
            <section className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                  <Car className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Vehicle Specifications</h2>
                  <p className="text-xs text-slate-400 font-medium">Core manufacturer & registration specifications</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { label: 'Vehicle Number', val: vehicle.vehicleNumber, highlight: true },
                  { label: 'Make / Brand', val: vehicle.brand || 'N/A' },
                  { label: 'Model', val: vehicle.model || 'N/A' },
                  { label: 'Variant', val: vehicle.variant || 'N/A' },
                  { label: 'Manufacturing Year', val: vehicle.year || 'N/A' },
                  { label: 'Fuel Type', val: vehicle.fuelType || 'N/A' },
                  { label: 'Color', val: vehicle.color || 'N/A' },
                  { label: 'Registered RTO', val: vehicle.registeredRTO || 'N/A' },
                  { label: 'Chassis Number', val: vehicle.chassisNumber || 'N/A' },
                  { label: 'Engine Number', val: vehicle.engineNumber || 'N/A' },
                ].map((spec) => (
                  <div key={spec.label} className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100/60 transition-colors hover:bg-slate-100/50">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{spec.label}</span>
                    <span className={`text-sm sm:text-base font-extrabold ${spec.highlight ? 'text-teal-600 font-black' : 'text-slate-800'}`}>{spec.val}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Section: Component Lifecycles */}
            <section className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                  <Wrench className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Component Lifecycles</h2>
                  <p className="text-xs text-slate-400 font-medium">Replaced consumable parts tracking</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { name: 'Battery', data: battery },
                  { name: 'Brake Pads', data: brakePads },
                  { name: 'Air Filter', data: airFilter }
                ].map((part) => (
                  <div key={part.name} className="flex flex-col p-5 bg-slate-50 rounded-2xl border border-slate-100/60 hover:border-teal-150 transition-colors">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">{part.name}</span>
                    {part.data ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-100 rounded-md text-[10px] font-black uppercase">
                          Replaced
                        </span>
                        <div className="text-sm font-extrabold text-slate-800 mt-1">{part.data.brand}</div>
                        <div className="text-xs text-slate-400 font-medium">
                          {new Date(part.data.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-xs font-black text-teal-600">₹{part.data.cost?.toLocaleString()}</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-md text-[10px] font-bold uppercase">
                          Original
                        </span>
                        <p className="text-xs text-slate-400 font-medium pt-2">No replacements logged.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Section 4: Service History Timeline */}
            <section className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-100">
                <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                  <History className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Service & Maintenance Log</h2>
                  <p className="text-xs text-slate-400 font-medium">Timeline of verified workshops and periodic services</p>
                </div>
              </div>

              {services.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium">
                  <Wrench className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                  No service records are currently logged for this vehicle.
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-100 ml-4 pl-6 sm:pl-8 space-y-8">
                  {services.map((service, index) => (
                    <div key={service.id} className="relative group">
                      
                      {/* Timeline Dot */}
                      <span className="absolute -left-[35px] sm:-left-[43px] top-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-teal-500 shadow-sm group-hover:scale-115 transition-transform">
                        <Wrench className="h-3 w-3 text-teal-600" />
                      </span>

                      {/* Content Card */}
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 hover:bg-slate-100/50 hover:border-teal-100 transition-all">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{service.serviceDate}</span>
                          </div>
                          {service.verifiedService && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-150 text-emerald-600 text-[10px] font-black uppercase rounded-lg shadow-sm">
                              <ShieldCheck className="h-3.5 w-3.5" /> Verified Service
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Service Type</span>
                            <span className="text-sm font-extrabold text-slate-800">{service.serviceType}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Workshop / Garage</span>
                            <span className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                              <Building2 className="h-4 w-4 text-slate-400 shrink-0" /> {service.garageName}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Cost</span>
                            <span className="text-sm font-black text-teal-600">₹{service.totalCost?.toLocaleString() || '0'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column (Sidebar Widgets) */}
          <div className="space-y-8">
            
            {/* Section 3: Health Score Widget */}
            <section className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow text-center">
              <h2 className="text-xs text-slate-450 font-black uppercase tracking-wider mb-6">Vehicle IQ Score</h2>
              
              <div className="relative inline-block mb-6">
                {/* Score Progress */}
                <svg viewBox="0 0 100 100" className="h-32 w-32 mx-auto">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="url(#passGrad)" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray="264" strokeDashoffset={264 - 264 * (healthScore / 100)} transform="rotate(-90 50 50)" />
                  <defs>
                    <linearGradient id="passGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#0d9488" />
                      <stop offset="100%" stopColor="#2dd4bf" />
                    </linearGradient>
                  </defs>
                </svg>
                
                {/* Score Value Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">{healthScore}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Score</span>
                </div>
              </div>

              <div>
                <span className={`px-4 py-1.5 border rounded-full text-xs font-bold inline-block shadow-sm ${conditionColor}`}>
                  {conditionText} Condition
                </span>
                <p className="text-xs text-slate-400 font-medium mt-3 leading-relaxed">
                  Evaluated using live odometer metrics, service consistency index, and maintenance timelines.
                </p>
              </div>
            </section>

            {/* Section 2: Current Owner Card */}
            <section className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-xs text-slate-450 font-black uppercase tracking-wider mb-6 pb-2 border-b border-slate-50">Current Owner Details</h2>
              <div className="flex items-center gap-4 mb-5">
                <div className="h-12 w-12 bg-teal-50 border border-teal-100 rounded-2xl flex items-center justify-center text-teal-600">
                  <User className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-900 truncate text-base">{owner.name}</h3>
                  <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest block">Registered Owner</span>
                </div>
              </div>
              
              <div className="space-y-3.5">
                {owner.phone && (
                  <div className="flex items-center gap-3 text-sm text-slate-650 hover:text-slate-900 transition-colors">
                    <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-xs sm:text-sm">{owner.phone}</span>
                  </div>
                )}
                {owner.email && (
                  <div className="flex items-center gap-3 text-sm text-slate-650 hover:text-slate-900 transition-colors">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-xs sm:text-sm break-all">{owner.email}</span>
                  </div>
                )}
                {!owner.phone && !owner.email && (
                  <span className="text-xs text-slate-400 font-medium block italic text-center">Owner contact details hidden or not provided.</span>
                )}
              </div>
            </section>

            {/* Section: Ownership History Timeline */}
            <section className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-xs text-slate-450 font-black uppercase tracking-wider mb-6 pb-2 border-b border-slate-50">Ownership History</h2>
              
              {ownershipHistory && ownershipHistory.length > 0 ? (
                <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-6">
                  {ownershipHistory.map((history, idx) => (
                    <div key={idx} className="relative group">
                      {/* Timeline Dot */}
                      <span className={`absolute -left-[31px] top-1.5 flex items-center justify-center w-4 h-4 rounded-full border-2 bg-white shadow-sm transition-transform ${
                        history.toDate ? 'border-slate-300' : 'border-teal-500'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          history.toDate ? 'bg-slate-400' : 'bg-teal-500'
                        }`} />
                      </span>

                      {/* Content */}
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-800 tracking-tight leading-none">
                          {history.ownerName}
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 block mt-1.5">
                          {history.toDate ? 'Previous Owner' : 'Current Owner'}
                        </span>
                        <div className="text-[10px] font-semibold text-slate-450 mt-1">
                          {new Date(history.fromDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} - {
                            history.toDate 
                              ? new Date(history.toDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                              : 'Present'
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-450 font-medium italic text-center">No history logs recorded.</p>
              )}
            </section>

            {/* Section 5: QR Code Card */}
            {vehicle.qrCodeUrl && (
              <section className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow text-center">
                <h2 className="text-xs text-slate-455 font-black uppercase tracking-wider mb-6">Digital Passport QR</h2>
                
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 inline-block mb-4 shadow-inner">
                  <img
                    src={vehicle.qrCodeUrl}
                    alt="Vehicle Passport QR Code"
                    className="h-44 w-44 object-contain mx-auto rounded-lg"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <QrCode className="h-4.5 w-4.5 text-teal-600" />
                    <span>Scan To View Vehicle Passport</span>
                  </div>
                  <button
                    onClick={handleDownloadQR}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all"
                  >
                    <Download className="h-4.5 w-4.5" />
                    Download QR Image
                  </button>
                </div>
              </section>
            )}

          </div>

        </div>
      </div>
    </div>
  );
};

export default Passport;
