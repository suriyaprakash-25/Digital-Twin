import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Wrench, CheckCircle, Calendar, Hash, IndianRupee, MapPin, Building, Plus, Trash2, ClipboardList, Shield, Info, Car, Camera, X, Receipt, FolderOpen, SwitchCamera } from 'lucide-react';

const AddService = () => {
    const [vehicles, setVehicles] = useState([]);
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

    const [partsReplaced, setPartsReplaced] = useState([]);
    const [billPhotos, setBillPhotos] = useState([]);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const billPhotoInputRef = useRef(null);

    // Camera modal state
    const [showCamera, setShowCamera] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [facingMode, setFacingMode] = useState('environment');
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        const fetchVehicles = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/vehicles/myvehicles', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setVehicles(res.data);
                if (res.data.length > 0) {
                    setFormData(prev => ({ ...prev, vehicleId: res.data[0].id }));
                }
            } catch (err) {
                console.error('Error fetching vehicles:', err);
                setStatus({ type: 'error', message: 'Failed to load your vehicles.' });
            }
        };
        fetchVehicles();
    }, []);

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const addPartRow = () => {
        setPartsReplaced([...partsReplaced, { partName: '', brand: '', cost: '' }]);
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

    const calculateTotalPartsCost = () => {
        return partsReplaced.reduce((sum, part) => sum + (parseFloat(part.cost) || 0), 0);
    };

    const calculateTotalCost = () => {
        return calculateTotalPartsCost() + (parseFloat(formData.laborCost) || 0);
    };

    // Compress a dataURL to max 1200px wide/tall at 0.72 JPEG quality
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

    // ── Camera helpers ──────────────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────────────────────────────────

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        if (!formData.vehicleId) {
            setStatus({ type: 'error', message: 'Please select a vehicle' });
            return;
        }

        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const submitPayload = {
                ...formData,
                partsReplaced: partsReplaced.filter(p => p.partName.trim() !== ''),
                billPhotoUrls: billPhotos
            };

            await axios.post('http://localhost:5000/api/services/add', submitPayload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            setStatus({ type: 'success', message: 'Production-grade service logged successfully!' });

            setTimeout(() => {
                navigate(`/service-history/${formData.vehicleId}`);
            }, 1500);

        } catch (err) {
            setStatus({
                type: 'error',
                message: err.response?.data?.msg || 'Failed to add service record. Please try again.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const renderInputGroup = (label, name, type = "text", icon = <Hash className="h-5 w-5" />, placeholder = "", options = null, extraProps = {}) => (
        <div className="space-y-2 pb-24 lg:pb-8">
            <label className="text-sm font-bold text-slate-700">{label}</label>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-teal-500 transition-colors">
                    {icon}
                </div>
                {options ? (
                    <select
                        name={name}
                        value={formData[name]}
                        onChange={handleChange}
                        {...extraProps}
                        className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium hover:border-slate-300 shadow-sm appearance-none cursor-pointer"
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
                        className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium hover:border-slate-300 shadow-sm"
                    />
                )}
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8">
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                    <Wrench className="h-8 w-8 text-teal-600" />
                    Log Service Entry
                </h1>
                <p className="text-slate-500 mt-2 font-medium text-lg">Create a highly structured, production-grade maintenance record.</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-8">
                {status.message && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold shadow-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {status.type === 'success' && <CheckCircle className="h-5 w-5" />}
                        {status.message}
                    </div>
                )}

                {/* Core Service Info */}
                <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="bg-teal-50 px-8 py-5 border-b border-teal-100 flex items-center gap-3">
                        <div className="p-2 bg-teal-100 rounded-lg text-teal-600"><ClipboardList /></div>
                        <h2 className="text-xl font-bold text-slate-800">Core Information</h2>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {renderInputGroup("Select Vehicle *", "vehicleId", "text", <Car className="h-5 w-5" />, "",
                            vehicles.map(v => ({ value: v.id, label: `${v.vehicleNumber} - ${v.brand || ''} ${v.model}` })),
                            { required: true }
                        )}
                        {renderInputGroup("Service Date *", "serviceDate", "date", <Calendar className="h-5 w-5" />, "", null, { required: true })}
                        {renderInputGroup("Current Odometer (km) *", "odometerKm", "number", <Hash className="h-5 w-5" />, "e.g. 45000", null, { required: true, min: 0 })}

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {renderInputGroup("Service Category *", "serviceCategory", "text", <ClipboardList className="h-5 w-5" />, "", ["Periodic Maintenance", "Unscheduled Repair", "Accidental Repair", "Inspection/Checkup", "Modification"], { required: true })}
                            {renderInputGroup("Specific Service Title *", "serviceType", "text", <Wrench className="h-5 w-5" />, "e.g. 40,000km Major Service", null, { required: true })}
                        </div>
                    </div>
                </div>

                {/* Detailed Work & Parts */}
                <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="bg-teal-50 px-8 py-5 border-b border-teal-100 flex items-center gap-3">
                        <div className="p-2 bg-teal-100 rounded-lg text-teal-600"><Wrench /></div>
                        <h2 className="text-xl font-bold text-slate-800 flex-1">Work Performed & Parts</h2>
                        <span className="bg-white px-4 py-1.5 rounded-full text-teal-700 font-black shadow-sm flex items-center gap-2">
                            <IndianRupee className="h-4 w-4" /> {calculateTotalCost().toLocaleString()} Total
                        </span>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* Parts Array */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-bold text-slate-700">Parts Replaced / Materials Used</label>
                                <button type="button" onClick={addPartRow} className="text-sm text-teal-600 bg-teal-50 hover:bg-teal-100 px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors">
                                    <Plus className="h-4 w-4" /> Add Part
                                </button>
                            </div>

                            {partsReplaced.length === 0 ? (
                                <div className="text-center py-6 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-slate-500 font-medium text-sm">
                                    No parts documented. Click "Add Part" to record specific replacements.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {partsReplaced.map((part, index) => (
                                        <div key={index} className="flex gap-4 items-center animate-in fade-in zoom-in duration-200">
                                            <input
                                                type="text"
                                                placeholder="Part Name (e.g. Battery)"
                                                value={part.partName}
                                                onChange={(e) => updatePartData(index, 'partName', e.target.value)}
                                                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Brand (e.g. Amaron)"
                                                value={part.brand || ''}
                                                onChange={(e) => updatePartData(index, 'brand', e.target.value)}
                                                className="w-48 px-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                            />
                                            <div className="relative w-36">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><IndianRupee className="h-4 w-4 text-slate-400" /></div>
                                                <input
                                                    type="number"
                                                    placeholder="Cost"
                                                    value={part.cost}
                                                    onChange={(e) => updatePartData(index, 'cost', e.target.value)}
                                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                                                />
                                            </div>
                                            <button type="button" onClick={() => removePartRow(index)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="text-right text-sm font-bold text-slate-600 pt-2">
                                        Parts Subtotal: ₹{calculateTotalPartsCost().toLocaleString()}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                            {renderInputGroup("Labor Charges (₹)", "laborCost", "number", <IndianRupee className="h-5 w-5" />, "0", null, { min: 0 })}
                            {renderInputGroup("Warranty Included (Months)", "warrantyMonths", "number", <Shield className="h-5 w-5" />, "e.g. 6", null, { min: 0 })}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Mechanic Notes / Observations</label>
                            <textarea
                                name="mechanicNotes"
                                value={formData.mechanicNotes}
                                onChange={handleChange}
                                placeholder="Any specific issues found, fluids topped up, or advisories for the owner..."
                                className="block w-full p-4 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium hover:border-slate-300 shadow-sm min-h-32"
                            />
                        </div>
                    </div>
                </div>

                {/* Provider Information */}
                <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="bg-emerald-50 px-8 py-5 border-b border-emerald-100 flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Building /></div>
                        <h2 className="text-xl font-bold text-slate-800">Service Provider</h2>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {renderInputGroup("Garage / Workshop Name", "garageName", "text", <Building className="h-5 w-5" />, "e.g. Authorized Honda Service")}
                        {renderInputGroup("Location City", "location", "text", <MapPin className="h-5 w-5" />, "e.g. Pune")}

                        <div className="md:col-span-2 flex justify-between gap-8 pt-4 border-t border-slate-100">
                            <div className="w-1/2">
                                {renderInputGroup("Next Recommended Km", "recommendedKm", "number", <Hash className="h-5 w-5" />, "e.g. 55000")}
                            </div>
                            <div className="w-1/2">
                                {renderInputGroup("Next Recommended Date", "recommendedDate", "date", <Calendar className="h-5 w-5" />)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Service Bill Photos */}
                <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="bg-violet-50 px-8 py-5 border-b border-violet-100 flex items-center gap-3">
                        <div className="p-2 bg-violet-100 rounded-lg text-violet-600"><Receipt /></div>
                        <h2 className="text-xl font-bold text-slate-800">Service Bill Photos</h2>
                        {billPhotos.length > 0 && (
                            <span className="ml-2 text-xs font-bold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full border border-violet-200">
                                {billPhotos.length} photo{billPhotos.length > 1 ? 's' : ''}
                            </span>
                        )}
                        <span className="ml-auto text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">Optional</span>
                    </div>
                    <div className="p-8">
                        {/* Hidden file input */}
                        <input
                            ref={billPhotoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleBillPhotoChange}
                        />

                        {billPhotos.length === 0 ? (
                            /* ── No photos yet: show two upload options ── */
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    type="button"
                                    onClick={openCamera}
                                    className="flex-1 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-violet-200 rounded-2xl py-10 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all group cursor-pointer"
                                >
                                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-violet-100 group-hover:scale-105 transition-transform">
                                        <Camera className="h-8 w-8 text-violet-500" />
                                    </div>
                                    <span className="text-sm font-bold text-violet-700">Take Photo</span>
                                    <span className="text-xs text-slate-400 font-medium">Open camera</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => billPhotoInputRef.current?.click()}
                                    className="flex-1 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl py-10 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all group cursor-pointer"
                                >
                                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
                                        <FolderOpen className="h-8 w-8 text-slate-400" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-600">Choose File</span>
                                    <span className="text-xs text-slate-400 font-medium">Browse gallery / files</span>
                                </button>
                            </div>
                        ) : (
                            /* ── Photos grid + add more card ── */
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {billPhotos.map((src, idx) => (
                                        <div key={idx} className="relative group rounded-xl overflow-hidden border-2 border-violet-100 shadow-sm aspect-square bg-slate-900 animate-in fade-in zoom-in duration-200">
                                            <img
                                                src={src}
                                                alt={`Bill ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Overlay on hover */}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-start justify-end p-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => removeBillPhoto(idx)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-lg"
                                                    title="Remove"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                            <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded-md">{idx + 1}</span>
                                        </div>
                                    ))}

                                    {/* Add more — camera */}
                                    <button
                                        type="button"
                                        onClick={openCamera}
                                        className="aspect-square flex flex-col items-center justify-center gap-2 border-2 border-dashed border-violet-200 rounded-xl bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all group cursor-pointer"
                                    >
                                        <div className="p-2.5 bg-white rounded-xl shadow-sm border border-violet-100 group-hover:scale-105 transition-transform">
                                            <Camera className="h-5 w-5 text-violet-500" />
                                        </div>
                                        <span className="text-xs font-bold text-violet-600">Take Photo</span>
                                    </button>

                                    {/* Add more — file */}
                                    <button
                                        type="button"
                                        onClick={() => billPhotoInputRef.current?.click()}
                                        className="aspect-square flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-all group cursor-pointer"
                                    >
                                        <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
                                            <Plus className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-500">Add Photo</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium pt-1">
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                    {billPhotos.length} photo{billPhotos.length > 1 ? 's' : ''} attached · hover a photo to remove it
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Camera Modal ─────────────────────────────────────────────── */}
                {showCamera && (
                    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="relative w-full max-w-2xl bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 bg-black/60 border-b border-white/10">
                                <span className="flex items-center gap-2 text-white font-bold text-sm">
                                    <Camera className="h-4 w-4 text-violet-400" /> Take Bill Photo
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={flipCamera}
                                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                                        title="Flip camera"
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

                            {/* Video feed */}
                            {cameraError ? (
                                <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4">
                                    <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
                                        <Camera className="h-10 w-10 text-red-400" />
                                    </div>
                                    <p className="text-red-300 font-semibold text-sm">{cameraError}</p>
                                    <button
                                        type="button"
                                        onClick={() => billPhotoInputRef.current?.click() || closeCamera()}
                                        className="mt-2 px-5 py-2.5 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors"
                                    >
                                        Choose File Instead
                                    </button>
                                </div>
                            ) : (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full max-h-[60vh] object-cover bg-black"
                                />
                            )}

                            {/* Hidden canvas for capture */}
                            <canvas ref={canvasRef} className="hidden" />

                            {/* Capture button */}
                            {!cameraError && (
                                <div className="flex items-center justify-center py-6 bg-black/60 border-t border-white/10">
                                    <button
                                        type="button"
                                        onClick={capturePhoto}
                                        className="w-16 h-16 rounded-full bg-white hover:bg-violet-100 border-4 border-violet-400 shadow-xl hover:scale-105 transition-all flex items-center justify-center"
                                        title="Capture"
                                    >
                                        <Camera className="h-7 w-7 text-violet-600" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <p className="text-white/30 text-xs mt-4">Click the button to capture · Press × to cancel</p>
                    </div>
                )}

                {/* Form Actions */}
                <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                        <Info className="h-4 w-4 text-teal-500" />
                        Odometer logic limits and integrity checks will apply.
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading || vehicles.length === 0}
                        className="w-full md:w-auto px-8 py-4 border border-transparent text-sm font-bold rounded-xl text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all shadow-md hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? 'Processing...' : (
                            <><ClipboardList className="h-5 w-5" /> Submit Service Record</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddService;
