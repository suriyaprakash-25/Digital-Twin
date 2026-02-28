import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Wrench, CheckCircle, Calendar, Hash, IndianRupee, MapPin, Building, Plus, Trash2, ClipboardList, Shield, Info, Car } from 'lucide-react';

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
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

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
        setPartsReplaced([...partsReplaced, { partName: '', cost: '' }]);
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
                partsReplaced: partsReplaced.filter(p => p.partName.trim() !== '')
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
        <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">{label}</label>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    {icon}
                </div>
                {options ? (
                    <select
                        name={name}
                        value={formData[name]}
                        onChange={handleChange}
                        {...extraProps}
                        className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium hover:border-slate-300 shadow-sm appearance-none cursor-pointer"
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
                        className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium hover:border-slate-300 shadow-sm"
                    />
                )}
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8">
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                    <Wrench className="h-8 w-8 text-blue-600" />
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
                    <div className="bg-blue-50 px-8 py-5 border-b border-blue-100 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><ClipboardList /></div>
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
                    <div className="bg-indigo-50 px-8 py-5 border-b border-indigo-100 flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Wrench /></div>
                        <h2 className="text-xl font-bold text-slate-800 flex-1">Work Performed & Parts</h2>
                        <span className="bg-white px-4 py-1.5 rounded-full text-indigo-700 font-black shadow-sm flex items-center gap-2">
                            <IndianRupee className="h-4 w-4" /> {calculateTotalCost().toLocaleString()} Total
                        </span>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* Parts Array */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-bold text-slate-700">Parts Replaced / Materials Used</label>
                                <button type="button" onClick={addPartRow} className="text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors">
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
                                                placeholder="Part Name (e.g. Engine Oil Filter)"
                                                value={part.partName}
                                                onChange={(e) => updatePartData(index, 'partName', e.target.value)}
                                                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                            <div className="relative w-48">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><IndianRupee className="h-4 w-4 text-slate-400" /></div>
                                                <input
                                                    type="number"
                                                    placeholder="Cost"
                                                    value={part.cost}
                                                    onChange={(e) => updatePartData(index, 'cost', e.target.value)}
                                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                                className="block w-full p-4 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium hover:border-slate-300 shadow-sm min-h-32"
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

                {/* Form Actions */}
                <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                        <Info className="h-4 w-4 text-blue-500" />
                        Odometer logic limits and integrity checks will apply.
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading || vehicles.length === 0}
                        className="w-full md:w-auto px-8 py-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
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
