import { API_BASE_URL } from '../utils/config';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Wrench,
  CheckCircle,
  Calendar,
  Hash,
  IndianRupee,
  MapPin,
  Building,
  Plus,
  Trash2,
  ClipboardList,
  Shield,
  Info,
  Car,
  Camera,
  X,
  Receipt,
  FolderOpen,
  SwitchCamera,
  CheckCircle2,
  FileText,
  User,
  ArrowLeft,
  Eye,
  AlertCircle
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import InvoiceModal from '../components/invoice/InvoiceModal';

const AddService = () => {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const completionMode = searchParams.get('completionMode') === 'true';
  const bookingIdParam = searchParams.get('bookingId') || '';
  const serviceIdParam = searchParams.get('serviceId') || '';

  const [vehicles, setVehicles] = useState([]);
  const [isGarage, setIsGarage] = useState(false);
  const [prefilledData, setPrefilledData] = useState(null);
  const [isLoadingPrefill, setIsLoadingPrefill] = useState(completionMode);

  const [formData, setFormData] = useState({
    // Core
    vehicleId: '',
    serviceDate: new Date().toISOString().split('T')[0],
    odometerKm: '',
    serviceCategory: 'Periodic Maintenance',
    serviceType: '',
    // Work
    laborCost: '',
    warrantyMonths: '',
    mechanicNotes: '',
    // Provider
    garageName: '',
    location: '',
    verifiedService: true,
    // Recommendations
    recommendedKm: '',
    recommendedDate: ''
  });

  // Line items
  const [partsReplaced, setPartsReplaced] = useState([]);
  const [labourCharges, setLabourCharges] = useState([
    { description: 'General Service Labour', quantity: 1, rate: '' }
  ]);
  const [additionalCharges, setAdditionalCharges] = useState([]);
  const [discount, setDiscount] = useState('');

  const [billPhotos, setBillPhotos] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const billPhotoInputRef = useRef(null);

  // Camera modal state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // ── Load Completion Details or Default Vehicles ──────────────────────────────
  useEffect(() => {
    const initPage = async () => {
      const token = localStorage.getItem('token');
      const userRaw = localStorage.getItem('user');
      const user = userRaw ? JSON.parse(userRaw) : null;
      const checkGarage = user && (user.role === 'GARAGE' || user.role === 'garage' || user.role === 'service_center' || user.role === 'servicecenter');
      setIsGarage(!!checkGarage);

      if (completionMode && (bookingIdParam || serviceIdParam)) {
        setIsLoadingPrefill(true);
        try {
          const detailsRes = await axios.get(`${API_BASE_URL}/api/services/completion-details`, {
            params: { bookingId: bookingIdParam, serviceId: serviceIdParam },
            headers: { Authorization: `Bearer ${token}` }
          });

          if (detailsRes.data?.success) {
            const d = detailsRes.data;
            setPrefilledData(d);
            setFormData(prev => ({
              ...prev,
              vehicleId: d.vehicle?.id || '',
              odometerKm: d.vehicle?.currentOdometerKm || d.service?.odometer || '',
              serviceDate: d.service?.date || new Date().toISOString().split('T')[0],
              serviceCategory: d.service?.category || 'Periodic Maintenance',
              serviceType: d.service?.title || 'General Service',
              garageName: d.garage?.name || '',
              location: d.garage?.location || ''
            }));
            if (d.service?.price) {
              setLabourCharges([{ description: `${d.service?.title || 'Service'} Labour`, quantity: 1, rate: String(d.service?.price) }]);
            }
          }
        } catch (err) {
          console.error('Error fetching completion details:', err);
          showToast('Could not load booking details for prefill', 'error');
        } finally {
          setIsLoadingPrefill(false);
        }
      }

      // Load vehicle list as fallback/choice
      try {
        const endpoint = checkGarage ? '/api/vehicles/all' : '/api/vehicles/myvehicles';
        const vRes = await axios.get(`${API_BASE_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setVehicles(vRes.data || []);

        if (!completionMode && vRes.data?.length > 0) {
          setFormData(prev => ({
            ...prev,
            vehicleId: prev.vehicleId || vRes.data[0].id
          }));
        }

        if (checkGarage && !completionMode) {
          try {
            const gRes = await axios.get(`${API_BASE_URL}/api/garages/me`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (gRes.data && gRes.data.exists) {
              setFormData(prev => ({
                ...prev,
                garageName: gRes.data.name || '',
                location: gRes.data.city || ''
              }));
            }
          } catch (gErr) {
            console.error('Error loading garage profile:', gErr);
          }
        }
      } catch (err) {
        console.error('Error loading vehicles:', err);
      }
    };

    initPage();
  }, [completionMode, bookingIdParam, serviceIdParam]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  // ── Parts Handlers ───────────────────────────────────────────────────────────
  const addPartRow = () => {
    setPartsReplaced([...partsReplaced, { partName: '', brand: '', quantity: 1, unitPrice: '' }]);
  };

  const removePartRow = (index) => {
    const newParts = [...partsReplaced];
    newParts.splice(index, 1);
    setPartsReplaced(newParts);
  };

  const updatePartData = (index, field, value) => {
    const newParts = [...partsReplaced];
    newParts[index][field] = value;
    setPartsReplaced(newParts);
  };

  // ── Labour Handlers ──────────────────────────────────────────────────────────
  const addLabourRow = () => {
    setLabourCharges([...labourCharges, { description: '', quantity: 1, rate: '' }]);
  };

  const removeLabourRow = (index) => {
    const newLabour = [...labourCharges];
    newLabour.splice(index, 1);
    setLabourCharges(newLabour);
  };

  const updateLabourData = (index, field, value) => {
    const newLabour = [...labourCharges];
    newLabour[index][field] = value;
    setLabourCharges(newLabour);
  };

  // ── Additional Charges Handlers ──────────────────────────────────────────────
  const addAdditionalChargeRow = () => {
    setAdditionalCharges([...additionalCharges, { description: '', amount: '' }]);
  };

  const removeAdditionalChargeRow = (index) => {
    const newCharges = [...additionalCharges];
    newCharges.splice(index, 1);
    setAdditionalCharges(newCharges);
  };

  const updateAdditionalChargeData = (index, field, value) => {
    const newCharges = [...additionalCharges];
    newCharges[index][field] = value;
    setAdditionalCharges(newCharges);
  };

  // ── Real-time Integer Paise Calculations ─────────────────────────────────────
  const financialTotals = useMemo(() => {
    // Parts Subtotal
    let partsSubtotal = 0;
    partsReplaced.forEach(p => {
      const qty = Math.max(1, parseInt(p.quantity, 10) || 1);
      const unitPrice = Math.max(0, parseFloat(p.unitPrice !== undefined ? p.unitPrice : (p.cost || 0)) || 0);
      partsSubtotal += qty * unitPrice;
    });

    // Labour Subtotal
    let labourSubtotal = 0;
    if (completionMode) {
      labourCharges.forEach(l => {
        const qty = Math.max(1, parseFloat(l.quantity !== undefined ? l.quantity : (l.hours || 1)) || 1);
        const rate = Math.max(0, parseFloat(l.rate || 0) || 0);
        labourSubtotal += qty * rate;
      });
    } else {
      labourSubtotal = Math.max(0, parseFloat(formData.laborCost || 0) || 0);
    }

    // Additional Charges Subtotal
    let additionalSubtotal = 0;
    additionalCharges.forEach(c => {
      const amt = Math.max(0, parseFloat(c.amount || 0) || 0);
      additionalSubtotal += amt;
    });

    const subtotal = partsSubtotal + labourSubtotal + additionalSubtotal;
    const discountNum = Math.max(0, parseFloat(discount || 0) || 0);
    const finalDiscount = Math.min(subtotal, discountNum);
    const taxableAmount = Math.max(0, subtotal - finalDiscount);

    // 18% GST (9% CGST + 9% SGST)
    const cgstAmount = Math.round(taxableAmount * 0.09 * 100) / 100;
    const sgstAmount = Math.round(taxableAmount * 0.09 * 100) / 100;
    const totalTax = cgstAmount + sgstAmount;
    const grandTotal = taxableAmount + totalTax;

    return {
      partsSubtotal,
      labourSubtotal,
      additionalSubtotal,
      subtotal,
      discount: finalDiscount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      totalTax,
      grandTotal
    };
  }, [partsReplaced, labourCharges, additionalCharges, discount, formData.laborCost, completionMode]);

  // ── Image compression & Camera ───────────────────────────────────────────────
  const compressImage = (dataUrl) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.src = dataUrl;
  });

  const handleBillPhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await compressImage(reader.result);
      setBillPhotos(prev => [...prev, compressed]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeBillPhoto = (idx) => {
    setBillPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing = facingMode) => {
    setCameraError('');
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setCameraError('Could not access camera. Please allow camera permission or use "Choose File".');
    }
  }, [facingMode, stopStream]);

  const openCamera = async () => {
    setShowCamera(true);
    await startCamera();
  };

  const closeCamera = () => {
    stopStream();
    setShowCamera(false);
    setCameraError('');
  };

  const flipCamera = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    await startCamera(next);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const raw = canvas.toDataURL('image/jpeg', 0.85);
    const compressed = await compressImage(raw);
    setBillPhotos(prev => [...prev, compressed]);
    closeCamera();
  };

  // ── Form Submission ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!formData.vehicleId) {
      setStatus({ type: 'error', message: 'Please select or verify the vehicle' });
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');

      if (completionMode) {
        // Complete Service & Generate Final Invoice
        const completePayload = {
          bookingId: bookingIdParam,
          serviceId: serviceIdParam,
          vehicleId: formData.vehicleId,
          odometer: formData.odometerKm,
          odometerKm: formData.odometerKm,
          serviceDate: formData.serviceDate,
          serviceCategory: formData.serviceCategory,
          serviceType: formData.serviceType,
          mechanicNotes: formData.mechanicNotes,
          parts: partsReplaced.filter(p => p.partName && p.partName.trim() !== ''),
          labour: labourCharges.filter(l => l.description && l.description.trim() !== ''),
          additionalCharges: additionalCharges.filter(c => c.description && c.description.trim() !== ''),
          discount: parseFloat(discount) || 0,
          warrantyMonths: formData.warrantyMonths,
          recommendedKm: formData.recommendedKm,
          recommendedDate: formData.recommendedDate,
          billPhotoUrls: billPhotos
        };

        const res = await axios.post(`${API_BASE_URL}/api/services/complete`, completePayload, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.data?.success) {
          setSuccessResult(res.data);
          showToast(`Service completed! Invoice ${res.data.invoiceNumber} generated.`, 'success');
        } else {
          throw new Error(res.data?.message || 'Failed to complete service');
        }
      } else {
        // Regular service log entry
        const submitPayload = {
          ...formData,
          partsReplaced: partsReplaced.filter(p => p.partName && p.partName.trim() !== ''),
          billPhotoUrls: billPhotos
        };

        await axios.post(`${API_BASE_URL}/api/services/add`, submitPayload, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        setStatus({ type: 'success', message: 'Service logged successfully!' });
        showToast('Service logged successfully!', 'success');

        setTimeout(() => {
          if (isGarage) {
            navigate('/garage-dashboard');
          } else {
            navigate(`/service-history/${formData.vehicleId}`);
          }
        }, 1500);
      }
    } catch (err) {
      console.error('Error logging/completing service:', err);
      setStatus({
        type: 'error',
        message: err.response?.data?.message || err.response?.data?.msg || err.message || 'Failed to complete service. Please try again.'
      });
      showToast(err.response?.data?.message || err.message || 'Operation failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderInputGroup = (label, name, type = "text", icon = <Hash className="h-4 w-4 md:h-5 md:w-5" />, placeholder = "", options = null, extraProps = {}) => (
    <div className="space-y-1 md:space-y-1.5 pb-1 md:pb-2">
      <label className="text-xs md:text-sm font-bold text-slate-700">{label}</label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-500 transition-colors">
          {icon}
        </div>
        {options ? (
          <select
            name={name}
            value={formData[name]}
            onChange={handleChange}
            {...extraProps}
            className="block w-full pl-9 md:pl-11 pr-3 md:pr-4 py-2 md:py-3 border border-slate-200 rounded-xl text-xs md:text-sm text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium hover:border-slate-300 shadow-sm appearance-none cursor-pointer"
          >
            {options.map(opt => (
              <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            name={name}
            type={type}
            placeholder={placeholder}
            value={formData[name]}
            onChange={handleChange}
            {...extraProps}
            className="block w-full pl-9 md:pl-11 pr-3 md:pr-4 py-2 md:py-3 border border-slate-200 rounded-xl text-xs md:text-sm text-slate-900 bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium hover:border-slate-300 shadow-sm"
          />
        )}
      </div>
    </div>
  );

  // ── Render Completion Success Screen ────────────────────────────────────────
  if (successResult) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 animate-in fade-in zoom-in-95 duration-400">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden text-center p-8 md:p-12">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black uppercase tracking-wider rounded-full">
            Service Finalized
          </span>

          <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 mt-3 tracking-tight">
            Service Completed Successfully
          </h1>
          <p className="text-slate-500 text-sm md:text-base mt-2 max-w-lg mx-auto font-medium">
            The customer has been notified and the authoritative GST tax invoice has been generated.
          </p>

          {/* Key Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8 text-left">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Invoice Number</div>
              <div className="text-base font-extrabold text-slate-900 mt-1 font-mono">{successResult.invoiceNumber}</div>
              <div className="text-xs text-teal-600 font-semibold mt-1">Tax Compliant</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Amount</div>
              <div className="text-xl font-black text-slate-900 mt-1 flex items-center">
                <IndianRupee className="h-4 w-4" /> {successResult.grandTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">Incl. 18% GST</div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Payment Status</div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-extrabold mt-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Awaiting Customer Payment
              </div>
            </div>
          </div>

          {/* Vehicle & Customer Details */}
          {prefilledData && (
            <div className="bg-teal-50/60 border border-teal-200/80 rounded-2xl p-5 mb-8 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-teal-100 text-teal-700 rounded-xl">
                  <Car className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {prefilledData.vehicle?.brand} {prefilledData.vehicle?.model} &bull; <span className="font-mono text-teal-700">{prefilledData.vehicle?.vehicleNumber}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">
                    Customer: <span className="font-bold text-slate-700">{prefilledData.customer?.name}</span> ({prefilledData.customer?.phone || prefilledData.customer?.email})
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500 font-semibold bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                Service: <span className="text-slate-900 font-bold">{formData.serviceType}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="w-full sm:w-auto px-6 py-3.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <FileText className="h-4 w-4" /> View Generated Invoice
            </button>
            <button
              onClick={() => navigate('/garage-services-history')}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              Back to Service History
            </button>
            <button
              onClick={() => navigate('/garage-dashboard')}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              Dashboard
            </button>
          </div>
        </div>

        {/* Reusable Invoice Modal */}
        {showInvoiceModal && (
          <InvoiceModal
            isOpen={showInvoiceModal}
            onClose={() => setShowInvoiceModal(false)}
            serviceId={successResult.serviceId || successResult.invoiceNumber}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 lg:pb-8">
      {/* Top Header */}
      <header className="mb-4 md:mb-8">
        {completionMode && (
          <button
            onClick={() => navigate('/garage-dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Vehicles In Progress
          </button>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
              <Wrench className="h-5 w-5 md:h-8 md:w-8 text-teal-600" />
              {completionMode ? 'Complete Service' : 'Log Service Entry'}
            </h1>
            <p className="text-slate-500 mt-1 font-medium text-xs md:text-base">
              {completionMode
                ? "Add the work performed, replaced components and labour charges to generate the customer's invoice."
                : 'Create a highly structured, production-grade maintenance record.'}
            </p>
          </div>
          {completionMode && (
            <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-xs font-black tracking-wide uppercase shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Completion Mode
            </span>
          )}
        </div>
      </header>

      {/* Prefilled Vehicle Card (Completion Mode) */}
      {completionMode && prefilledData && (
        <div className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-2xl md:rounded-3xl p-5 md:p-6 mb-6 shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                <Car className="h-8 w-8 text-white" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-100 block">Assigned Vehicle</span>
                <h2 className="text-lg md:text-2xl font-black">
                  {prefilledData.vehicle?.brand} {prefilledData.vehicle?.model}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-white/20 text-white font-mono text-xs font-bold px-2 py-0.5 rounded">
                    {prefilledData.vehicle?.vehicleNumber}
                  </span>
                  <span className="text-xs text-teal-100 font-medium">
                    Owner: <strong>{prefilledData.customer?.name}</strong>
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm px-4 py-2 rounded-xl text-right self-stretch sm:self-auto flex sm:flex-col justify-between items-center sm:items-end">
              <span className="text-[11px] font-bold text-teal-100 uppercase">Service Category</span>
              <span className="text-sm font-extrabold text-white mt-0.5">{formData.serviceCategory}</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-8">
        {status.message && (
          <div className={`p-3 md:p-4 rounded-xl flex items-center gap-3 text-xs md:text-sm font-semibold shadow-sm ${
            status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {status.type === 'success' ? <CheckCircle className="h-4.5 w-4.5 md:h-5 md:w-5" /> : <AlertCircle className="h-4.5 w-4.5 md:h-5 md:w-5" />}
            {status.message}
          </div>
        )}

        {/* 1. Core Service Info */}
        <div className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-teal-50 px-4 py-2.5 md:px-8 md:py-5 border-b border-teal-100 flex items-center gap-2.5">
            <div className="p-1 md:p-1.5 bg-teal-100 rounded-lg text-teal-600"><ClipboardList className="h-4 w-4 md:h-5 md:w-5" /></div>
            <h2 className="text-sm md:text-xl font-bold text-slate-800">1. Core Information</h2>
          </div>
          <div className="p-3 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
            {!completionMode ? (
              renderInputGroup("Select Vehicle *", "vehicleId", "text", <Car className="h-4 w-4 md:h-5 md:w-5" />, "",
                vehicles.map(v => ({ value: v.id, label: v.vehicleNumber ? `${v.vehicleNumber} - ${v.brand || ''} ${v.model} (${v.ownerName || 'No Owner'})` : `${v.brand || ''} ${v.model}` })),
                { required: true }
              )
            ) : (
              <div className="space-y-1 md:space-y-1.5 pb-1 md:pb-2">
                <label className="text-xs md:text-sm font-bold text-slate-700">Vehicle (Locked to Job)</label>
                <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-bold text-xs md:text-sm">
                  <Car className="h-4 w-4 text-teal-600" />
                  <span>{prefilledData?.vehicle?.vehicleNumber} &bull; {prefilledData?.vehicle?.brand} {prefilledData?.vehicle?.model}</span>
                </div>
              </div>
            )}
            {renderInputGroup("Service Date *", "serviceDate", "date", <Calendar className="h-4 w-4 md:h-5 md:w-5" />, "", null, { required: true })}
            {renderInputGroup("Current Odometer (km) *", "odometerKm", "number", <Hash className="h-4 w-4 md:h-5 md:w-5" />, "e.g. 45000", null, { required: true, min: 0 })}

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
              {renderInputGroup("Service Category *", "serviceCategory", "text", <ClipboardList className="h-4 w-4 md:h-5 md:w-5" />, "", ["Periodic Maintenance", "Unscheduled Repair", "Accidental Repair", "Inspection/Checkup", "Modification"], { required: true })}
              {renderInputGroup("Specific Service Title *", "serviceType", "text", <Wrench className="h-4 w-4 md:h-5 md:w-5" />, "e.g. Oil & Filter Change, Brake Service", null, { required: true })}
            </div>
          </div>
        </div>

        {/* 2. Detailed Work Performed & Observations */}
        <div className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-teal-50 px-4 py-2.5 md:px-8 md:py-5 border-b border-teal-100 flex items-center gap-2.5">
            <div className="p-1 md:p-1.5 bg-teal-100 rounded-lg text-teal-600"><Wrench className="h-4 w-4 md:h-5 md:w-5" /></div>
            <h2 className="text-sm md:text-xl font-bold text-slate-800">2. Work Performed & Observations</h2>
          </div>
          <div className="p-3 md:p-8 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs md:text-sm font-bold text-slate-700">Mechanic Notes / Observations</label>
              <textarea
                name="mechanicNotes"
                value={formData.mechanicNotes}
                onChange={handleChange}
                placeholder="Details on engine oil grade, filter condition, diagnostics run, fluid top-ups, or notes for the customer..."
                className="block w-full p-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium hover:border-slate-300 shadow-sm min-h-24 text-xs md:text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 pt-2">
              {renderInputGroup("Warranty Included (Months)", "warrantyMonths", "number", <Shield className="h-4 w-4 md:h-5 md:w-5" />, "e.g. 6", null, { min: 0 })}
              {renderInputGroup("Next Recommended Date", "recommendedDate", "date", <Calendar className="h-4 w-4 md:h-5 md:w-5" />)}
            </div>
          </div>
        </div>

        {/* 3. Replaced Components / Parts */}
        <div className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-teal-50 px-4 py-2.5 md:px-8 md:py-5 border-b border-teal-100 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-1 md:p-1.5 bg-teal-100 rounded-lg text-teal-600"><Wrench className="h-4 w-4 md:h-5 md:w-5" /></div>
              <h2 className="text-sm md:text-xl font-bold text-slate-800">3. Parts Replaced / Materials Used</h2>
            </div>
            <button
              type="button"
              onClick={addPartRow}
              className="text-xs sm:text-sm text-teal-700 bg-white hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Part
            </button>
          </div>

          <div className="p-3 md:p-8 space-y-4">
            {partsReplaced.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-slate-500 font-medium text-xs md:text-sm">
                No parts documented. Click <strong className="text-teal-700 font-bold">"+ Add Part"</strong> to record replaced components (e.g. Engine Oil, Oil Filter, Brake Pads).
              </div>
            ) : (
              <div className="space-y-3">
                <div className="hidden md:grid grid-cols-12 gap-3 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span className="col-span-4">Part Name</span>
                  <span className="col-span-3">Brand / Spec</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-2 text-right">Unit Price (₹)</span>
                  <span className="col-span-1 text-center">Action</span>
                </div>

                {partsReplaced.map((part, index) => {
                  const qty = parseInt(part.quantity, 10) || 1;
                  const unitPrice = parseFloat(part.unitPrice !== undefined ? part.unitPrice : (part.cost || 0)) || 0;
                  const lineTotal = qty * unitPrice;

                  return (
                    <div key={index} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 items-stretch md:items-center p-3 bg-slate-50 border border-slate-200/80 rounded-xl md:rounded-2xl animate-in fade-in zoom-in duration-200">
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Part Name (e.g. Engine Oil)"
                          value={part.partName}
                          onChange={(e) => updatePartData(index, 'partName', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs md:text-sm font-semibold shadow-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Brand / Grade (e.g. Castrol 5W-30)"
                          value={part.brand || ''}
                          onChange={(e) => updatePartData(index, 'brand', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs md:text-sm shadow-sm"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-1.5">
                        <span className="md:hidden text-xs text-slate-500 font-bold">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={part.quantity !== undefined ? part.quantity : 1}
                          onChange={(e) => updatePartData(index, 'quantity', e.target.value)}
                          className="w-full text-center px-2 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs md:text-sm font-bold shadow-sm"
                        />
                      </div>
                      <div className="col-span-2 relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <IndianRupee className="h-3 w-3" />
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Unit Price"
                          value={part.unitPrice !== undefined ? part.unitPrice : part.cost}
                          onChange={(e) => updatePartData(index, 'unitPrice', e.target.value)}
                          className="w-full pl-7 pr-2 py-2 text-right border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs md:text-sm font-bold shadow-sm"
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-between md:justify-center">
                        <span className="md:hidden text-xs font-black text-slate-700">
                          Total: ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePartRow(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-end pt-2 text-xs md:text-sm font-extrabold text-slate-700">
                  <span>Parts Subtotal: <strong className="text-teal-700 font-mono text-base">₹{financialTotals.partsSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Labour Charges */}
        <div className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-teal-50 px-4 py-2.5 md:px-8 md:py-5 border-b border-teal-100 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-1 md:p-1.5 bg-teal-100 rounded-lg text-teal-600"><Wrench className="h-4 w-4 md:h-5 md:w-5" /></div>
              <h2 className="text-sm md:text-xl font-bold text-slate-800">4. Labour Charges</h2>
            </div>
            {completionMode && (
              <button
                type="button"
                onClick={addLabourRow}
                className="text-xs sm:text-sm text-teal-700 bg-white hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add Labour
              </button>
            )}
          </div>

          <div className="p-3 md:p-8 space-y-4">
            {completionMode ? (
              <div className="space-y-3">
                <div className="hidden md:grid grid-cols-12 gap-3 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span className="col-span-6">Description</span>
                  <span className="col-span-2 text-center">Hours / Units</span>
                  <span className="col-span-3 text-right">Rate / Hr (₹)</span>
                  <span className="col-span-1 text-center">Action</span>
                </div>

                {labourCharges.map((labour, index) => {
                  const qty = parseFloat(labour.quantity || 1) || 1;
                  const rate = parseFloat(labour.rate || 0) || 0;
                  const lineTotal = qty * rate;

                  return (
                    <div key={index} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 items-stretch md:items-center p-3 bg-slate-50 border border-slate-200/80 rounded-xl md:rounded-2xl animate-in fade-in zoom-in duration-200">
                      <div className="col-span-6">
                        <input
                          type="text"
                          placeholder="Labour description (e.g. Periodic Service Labour)"
                          value={labour.description}
                          onChange={(e) => updateLabourData(index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs md:text-sm font-semibold shadow-sm"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-1.5">
                        <span className="md:hidden text-xs text-slate-500 font-bold">Hours:</span>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          placeholder="Hours"
                          value={labour.quantity}
                          onChange={(e) => updateLabourData(index, 'quantity', e.target.value)}
                          className="w-full text-center px-2 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs md:text-sm font-bold shadow-sm"
                        />
                      </div>
                      <div className="col-span-3 relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <IndianRupee className="h-3 w-3" />
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Rate"
                          value={labour.rate}
                          onChange={(e) => updateLabourData(index, 'rate', e.target.value)}
                          className="w-full pl-7 pr-2 py-2 text-right border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs md:text-sm font-bold shadow-sm"
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-between md:justify-center">
                        <span className="md:hidden text-xs font-black text-slate-700">
                          Total: ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLabourRow(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-end pt-2 text-xs md:text-sm font-extrabold text-slate-700">
                  <span>Labour Subtotal: <strong className="text-teal-700 font-mono text-base">₹{financialTotals.labourSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                </div>
              </div>
            ) : (
              <div>
                {renderInputGroup("Labor Charges (₹)", "laborCost", "number", <IndianRupee className="h-4 w-4 md:h-5 md:w-5" />, "0", null, { min: 0 })}
              </div>
            )}
          </div>
        </div>

        {/* 5. Additional Charges & Discount */}
        {completionMode && (
          <div className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-teal-50 px-4 py-2.5 md:px-8 md:py-5 border-b border-teal-100 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-1 md:p-1.5 bg-teal-100 rounded-lg text-teal-600"><Plus className="h-4 w-4 md:h-5 md:w-5" /></div>
                <h2 className="text-sm md:text-xl font-bold text-slate-800">5. Additional Charges & Discounts</h2>
              </div>
              <button
                type="button"
                onClick={addAdditionalChargeRow}
                className="text-xs sm:text-sm text-teal-700 bg-white hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add Charge
              </button>
            </div>

            <div className="p-3 md:p-8 space-y-4">
              {additionalCharges.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs md:text-sm font-bold text-slate-700">Additional Charges (Consumables, Disposal, etc.)</label>
                  {additionalCharges.map((charge, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Charge description (e.g. Consumables & Environmental Fee)"
                        value={charge.description}
                        onChange={(e) => updateAdditionalChargeData(index, 'description', e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white text-xs md:text-sm"
                      />
                      <div className="relative w-36">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                          <IndianRupee className="h-3 w-3" />
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Amount"
                          value={charge.amount}
                          onChange={(e) => updateAdditionalChargeData(index, 'amount', e.target.value)}
                          className="w-full pl-7 pr-2 py-2 text-right border border-slate-200 rounded-lg text-slate-900 bg-white text-xs md:text-sm font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAdditionalChargeRow(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs md:text-sm font-bold text-slate-700">Special Discount (₹)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IndianRupee className="h-4 w-4" />
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white text-xs md:text-sm font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. Real-time Invoice Calculation Summary (Completion Mode) */}
        {completionMode && (
          <div className="bg-slate-900 text-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-teal-400" />
                <h3 className="text-base md:text-lg font-bold text-white">Invoice Summary Preview</h3>
              </div>
              <span className="text-xs font-bold text-teal-400 bg-teal-950/80 px-2.5 py-1 rounded-full border border-teal-800">
                18% GST Applicable
              </span>
            </div>

            <div className="space-y-2.5 text-xs md:text-sm font-medium">
              <div className="flex justify-between text-slate-300">
                <span>Parts Subtotal</span>
                <span className="font-mono">₹{financialTotals.partsSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Labour Subtotal</span>
                <span className="font-mono">₹{financialTotals.labourSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {financialTotals.additionalSubtotal > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Additional Charges</span>
                  <span className="font-mono">₹{financialTotals.additionalSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-200 border-t border-slate-800 pt-2">
                <span>Gross Subtotal</span>
                <span className="font-mono">₹{financialTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {financialTotals.discount > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Discount</span>
                  <span className="font-mono">-₹{financialTotals.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300">
                <span>Taxable Amount</span>
                <span className="font-mono">₹{financialTotals.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-xs pl-2">
                <span>&bull; CGST (9.0%)</span>
                <span className="font-mono">₹{financialTotals.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-xs pl-2">
                <span>&bull; SGST (9.0%)</span>
                <span className="font-mono">₹{financialTotals.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-extrabold text-teal-400 tracking-wider block">Authoritative Grand Total</span>
                <span className="text-[11px] text-slate-400">Calculated server-side in integer paise</span>
              </div>
              <div className="text-2xl md:text-4xl font-black text-white font-mono flex items-center">
                <IndianRupee className="h-6 w-6 md:h-8 md:w-8 text-teal-400" />
                {financialTotals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}

        {/* Photos Section */}
        <div className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-violet-50 px-4 py-2.5 md:px-8 md:py-5 border-b border-violet-100 flex items-center gap-2.5">
            <div className="p-1 md:p-1.5 bg-violet-100 rounded-lg text-violet-600"><Receipt className="h-4 w-4 md:h-5 md:w-5" /></div>
            <h2 className="text-sm md:text-xl font-bold text-slate-800">Service Photos & Documentation</h2>
            {billPhotos.length > 0 && (
              <span className="ml-2 text-[10px] sm:text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-violet-200">
                {billPhotos.length} photo{billPhotos.length > 1 ? 's' : ''}
              </span>
            )}
            <span className="ml-auto text-[10px] sm:text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">Optional</span>
          </div>
          <div className="p-3 md:p-8">
            <input
              ref={billPhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBillPhotoChange}
            />

            {billPhotos.length === 0 ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={openCamera}
                  className="flex-1 flex flex-col items-center justify-center gap-2 md:gap-3 border-2 border-dashed border-violet-200 rounded-2xl py-6 md:py-10 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all group cursor-pointer"
                >
                  <div className="p-3 md:p-4 bg-white rounded-2xl shadow-sm border border-violet-100 group-hover:scale-105 transition-transform">
                    <Camera className="h-6 w-6 md:h-8 md:w-8 text-violet-500" />
                  </div>
                  <span className="text-xs md:text-sm font-bold text-violet-700">Take Photo</span>
                  <span className="text-[10px] md:text-xs text-slate-400 font-medium">Open camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => billPhotoInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center justify-center gap-2 md:gap-3 border-2 border-dashed border-slate-200 rounded-2xl py-6 md:py-10 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all group cursor-pointer"
                >
                  <div className="p-3 md:p-4 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
                    <FolderOpen className="h-6 w-6 md:h-8 md:w-8 text-slate-400" />
                  </div>
                  <span className="text-xs md:text-sm font-bold text-slate-600">Choose File</span>
                  <span className="text-[10px] md:text-xs text-slate-400 font-medium">Browse gallery / files</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {billPhotos.map((src, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border-2 border-violet-100 shadow-sm aspect-square bg-slate-900 animate-in fade-in zoom-in duration-200">
                      <img src={src} alt={`Bill ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-start justify-end p-1.5">
                        <button
                          type="button"
                          onClick={() => removeBillPhoto(idx)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-lg cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded-md">{idx + 1}</span>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={openCamera}
                    className="aspect-square flex flex-col items-center justify-center gap-1.5 md:gap-2 border-2 border-dashed border-violet-200 rounded-xl bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all group cursor-pointer"
                  >
                    <Camera className="h-5 w-5 text-violet-500" />
                    <span className="text-[10px] md:text-xs font-bold text-violet-600">Take Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => billPhotoInputRef.current?.click()}
                    className="aspect-square flex flex-col items-center justify-center gap-1.5 md:gap-2 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all group cursor-pointer"
                  >
                    <Plus className="h-5 w-5 text-slate-400" />
                    <span className="text-[10px] md:text-xs font-bold text-slate-500">Add Photo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Camera Modal */}
        {showCamera && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
              <div className="flex items-center justify-between px-5 py-4 bg-black/60 border-b border-white/10">
                <span className="flex items-center gap-2 text-white font-bold text-sm">
                  <Camera className="h-4 w-4 text-violet-400" /> Take Bill Photo
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={flipCamera}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <SwitchCamera className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="p-2 rounded-full bg-white/10 hover:bg-red-500/80 text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {cameraError ? (
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4">
                  <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
                    <Camera className="h-10 w-10 text-red-400" />
                  </div>
                  <p className="text-red-300 font-semibold text-sm">{cameraError}</p>
                </div>
              ) : (
                <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-[60vh] object-cover bg-black" />
              )}

              <canvas ref={canvasRef} className="hidden" />

              {!cameraError && (
                <div className="flex items-center justify-center py-6 bg-black/60 border-t border-white/10">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full bg-white hover:bg-violet-100 border-4 border-violet-400 shadow-xl hover:scale-105 transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Camera className="h-7 w-7 text-violet-600" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
            <Info className="h-4 w-4 text-teal-500 shrink-0" />
            <span>Tax snapshot and atomic financial integrity rules will be applied upon submission.</span>
          </div>

          <button
            type="submit"
            disabled={isLoading || (completionMode ? !formData.vehicleId : vehicles.length === 0)}
            className="w-full md:w-auto px-8 py-4 border border-transparent text-sm font-black rounded-xl text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              'Processing...'
            ) : completionMode ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-300" /> Complete Service & Generate Invoice
              </>
            ) : (
              <>
                <ClipboardList className="h-5 w-5" /> Submit Service Record
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddService;
