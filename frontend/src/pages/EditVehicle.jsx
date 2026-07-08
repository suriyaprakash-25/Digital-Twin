import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Car, CheckCircle, Hash, Calendar, Fuel, FileText, User, Phone, IndianRupee, Activity, Tag, Shield, FileCheck, Layers, ArrowLeft } from 'lucide-react';

const EditVehicle = () => {
    const { id } = useParams();
    const [formData, setFormData] = useState({
        // Identity
        vehicleNumber: '', brand: '', model: '', variant: '', vehicleType: 'Car', fuelType: 'Petrol', color: '', year: '', registrationDate: '', registeredRTO: '',
        // Ownership
        ownerName: '', phone: '', ownershipCount: '1', purchaseDate: '', purchasePrice: '',
        // Legal
        insuranceProvider: '', insuranceExpiry: '', pucExpiry: '', rcExpiry: '', roadTaxValidTill: '', fitnessExpiry: '',
        // Verification
        chassisNumber: '', engineNumber: '',
        // Usage
        currentOdometerKm: '', averageMonthlyKm: ''
    });
    const [rcBookFile, setRcBookFile] = useState(null);
    const [insuranceFile, setInsuranceFile] = useState(null);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchVehicle = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/vehicles/myvehicles`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const vehicle = res.data.find(v => v.id === id);
                if (vehicle) {
                    // Map backend to form
                    const mapped = {};
                    Object.keys(formData).forEach(key => {
                        if (vehicle[key] !== null && vehicle[key] !== undefined) {
                            // format dates to YYYY-MM-DD
                            if (['registrationDate', 'purchaseDate', 'insuranceExpiry', 'pucExpiry', 'rcExpiry', 'roadTaxValidTill', 'fitnessExpiry'].includes(key) && vehicle[key]) {
                                mapped[key] = new Date(vehicle[key]).toISOString().split('T')[0];
                            } else {
                                mapped[key] = vehicle[key].toString();
                            }
                        }
                    });
                    setFormData(prev => ({ ...prev, ...mapped }));
                } else {
                    setStatus({ type: 'error', message: 'Vehicle not found' });
                }
            } catch (err) {
                setStatus({ type: 'error', message: 'Failed to fetch vehicle details' });
            } finally {
                setInitialLoading(false);
            }
        };
        fetchVehicle();
    }, [id]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const submitData = new FormData();
            Object.keys(formData).forEach(key => submitData.append(key, formData[key]));
            if (rcBookFile) submitData.append('rcBook', rcBookFile);
            if (insuranceFile) submitData.append('insuranceDocument', insuranceFile);

            await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/vehicles/${id}`, submitData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setStatus({ type: 'success', message: 'Vehicle updated successfully!' });
            setTimeout(() => navigate('/my-vehicles'), 1500);
        } catch (err) {
            setStatus({
                type: 'error',
                message: err.response?.data?.msg || 'Failed to update vehicle. Please try again.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const renderInputGroup = (label, name, type = "text", icon = <Hash className="h-4 w-4 md:h-5 md:w-5" />, placeholder = "", options = null, extraProps = {}) => (
        <div className="space-y-1.5 pb-1 lg:pb-2">
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
                        required={extraProps.required}
                        className="block w-full pl-9 pr-3 py-2 md:py-3 border border-slate-200 rounded-xl text-xs md:text-sm text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium hover:border-slate-300 shadow-sm appearance-none cursor-pointer"
                    >
                        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                ) : (
                    <input
                        name={name}
                        type={type}
                        placeholder={placeholder}
                        value={formData[name]}
                        onChange={handleChange}
                        {...extraProps}
                        className="block w-full pl-9 pr-3 py-2 md:py-3 border border-slate-200 rounded-xl text-xs md:text-sm text-slate-900 bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium hover:border-slate-300 shadow-sm"
                    />
                )}
            </div>
        </div>
    );

    if (initialLoading) {
        return (
            <div className="flex justify-center items-center py-24">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 lg:pb-8">
            <Link
                to="/my-vehicles"
                className="inline-flex items-center text-xs md:text-sm font-bold text-slate-500 hover:text-teal-600 mb-4 md:mb-6 transition-colors bg-white px-3 py-1.5 md:px-4 md:py-2 border border-slate-200 rounded-xl shadow-sm hover:shadow-md"
            >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5 md:h-4 md:w-4 md:mr-2" />
                Back to Vehicles
            </Link>

            <header className="mb-3 md:mb-8">
                <h1 className="text-xl md:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 md:gap-3">
                    <Car className="h-5 w-5 md:h-8 md:w-8 text-teal-600" /> Edit Vehicle
                </h1>
                <p className="text-slate-555 mt-0.5 font-medium text-xs md:text-lg">Update your driveportz's production-grade lifecycle tracking data.</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-8">
                {status.message && (
                    <div className={`p-3 md:p-4 rounded-xl flex items-center gap-3 text-xs md:text-sm font-semibold shadow-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {status.type === 'success' && <CheckCircle className="h-4.5 w-4.5 md:h-5 md:w-5" />}
                        {status.message}
                    </div>
                )}

                {/* Identity Details */}
                <div className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
                    <div className="bg-teal-50 px-4 py-2.5 md:px-8 md:py-5 border-b border-teal-100 flex items-center gap-2.5">
                        <div className="p-1 md:p-1.5 bg-teal-100 rounded-lg text-teal-600"><Car className="h-4 w-4 md:h-5 md:w-5" /></div>
                        <h2 className="text-sm md:text-xl font-bold text-slate-800">Identity Details</h2>
                    </div>
                    <div className="p-3 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
                        {renderInputGroup("Vehicle Number *", "vehicleNumber", "text", <Hash className="h-4 w-4 md:h-5 md:w-5" />, "e.g. MH12AB1234", null, { required: true })}
                        {renderInputGroup("Vehicle Type", "vehicleType", "text", <Layers className="h-4 w-4 md:h-5 md:w-5" />, "", ["Commercial", "Car", "Bike", "Truck"])}
                        {renderInputGroup("Brand", "brand", "text", <Tag className="h-4 w-4 md:h-5 md:w-5" />, "e.g. Honda")}
                        {renderInputGroup("Model Name *", "model", "text", <Car className="h-4 w-4 md:h-5 md:w-5" />, "e.g. City", null, { required: true })}
                        {renderInputGroup("Variant", "variant", "text", <Layers className="h-4 w-4 md:h-5 md:w-5" />, "e.g. VX CVT")}
                        {renderInputGroup("Fuel Type *", "fuelType", "text", <Fuel className="h-4 w-4 md:h-5 md:w-5" />, "", ["Petrol", "Diesel", "Electric", "Hybrid", "CNG"], { required: true })}
                        {renderInputGroup("Color", "color", "text", <Tag className="h-4 w-4 md:h-5 md:w-5" />, "e.g. Lunar Silver")}
                        {renderInputGroup("Manufacturing Year *", "year", "number", <Calendar className="h-4 w-4 md:h-5 md:w-5" />, "e.g. 2021", null, { required: true, min: "1900", max: new Date().getFullYear() + 1 })}
                        {renderInputGroup("Registration Date", "registrationDate", "date", <Calendar className="h-4 w-4 md:h-5 md:w-5" />)}
                        {renderInputGroup("Registered RTO", "registeredRTO", "text", <CheckCircle className="h-4 w-4 md:h-5 md:w-5" />, "e.g. Pune RTO")}
                    </div>
                </div>

                {/* Ownership Details */}
                <div className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
                    <div className="bg-teal-50 px-4 py-2.5 md:px-8 md:py-5 border-b border-teal-100 flex items-center gap-2.5">
                        <div className="p-1 md:p-1.5 bg-teal-100 rounded-lg text-teal-600"><User className="h-4 w-4 md:h-5 md:w-5" /></div>
                        <h2 className="text-sm md:text-xl font-bold text-slate-800">Ownership Details</h2>
                    </div>
                    <div className="p-3 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
                        {renderInputGroup("Owner Name", "ownerName", "text", <User className="h-4 w-4 md:h-5 md:w-5" />, "e.g. John Doe")}
                        {renderInputGroup("Phone Number", "phone", "tel", <Phone className="h-4 w-4 md:h-5 md:w-5" />, "e.g. 9876543210")}
                        {renderInputGroup("Ownership Count", "ownershipCount", "number", <Hash className="h-4 w-4 md:h-5 md:w-5" />, "1", null, { min: 1 })}
                        {renderInputGroup("Purchase Date", "purchaseDate", "date", <Calendar className="h-4 w-4 md:h-5 md:w-5" />)}
                        {renderInputGroup("Purchase Price (₹)", "purchasePrice", "number", <IndianRupee className="h-4 w-4 md:h-5 md:w-5" />, "e.g. 1000000")}
                    </div>
                </div>

                {/* Legal & Validity */}
                <div className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
                    <div className="bg-emerald-50 px-4 py-2.5 md:px-8 md:py-5 border-b border-emerald-100 flex items-center gap-2.5">
                        <div className="p-1 md:p-1.5 bg-emerald-100 rounded-lg text-emerald-600"><Shield className="h-4 w-4 md:h-5 md:w-5" /></div>
                        <h2 className="text-sm md:text-xl font-bold text-slate-800">Legal Validity (Expiries)</h2>
                    </div>
                    <div className="p-3 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
                        {renderInputGroup("Insurance Provider", "insuranceProvider", "text", <Shield className="h-4 w-4 md:h-5 md:w-5" />, "e.g. HDFC ERGO")}
                        {renderInputGroup("Insurance Expiry", "insuranceExpiry", "date", <Calendar className="h-4 w-4 md:h-5 md:w-5" />)}
                        {renderInputGroup("PUC Expiry", "pucExpiry", "date", <Calendar className="h-4 w-4 md:h-5 md:w-5" />)}
                        {renderInputGroup("RC Expiry", "rcExpiry", "date", <Calendar className="h-4 w-4 md:h-5 md:w-5" />)}
                        {renderInputGroup("Road Tax Valid Till", "roadTaxValidTill", "date", <Calendar className="h-4 w-4 md:h-5 md:w-5" />)}
                        {renderInputGroup("Fitness Expiry", "fitnessExpiry", "date", <Calendar className="h-4 w-4 md:h-5 md:w-5" />)}
                    </div>
                </div>

                {/* Verification & Usage */}
                <div className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                    <div className="w-full md:w-1/2 p-3 md:p-8">
                        <h3 className="text-sm md:text-lg font-bold text-slate-800 flex items-center gap-2 mb-3 md:mb-6"><FileCheck className="text-slate-400 h-4 w-4 md:h-5 md:w-5" /> Verification Details</h3>
                        <div className="space-y-4 md:space-y-6">
                            {renderInputGroup("Chassis Number", "chassisNumber", "text", <Hash className="h-4 w-4 md:h-5 md:w-5" />, "17-digit VIN")}
                            {renderInputGroup("Engine Number", "engineNumber", "text", <Hash className="h-4 w-4 md:h-5 md:w-5" />, "")}

                            <div className="space-y-1.5">
                                <label className="text-xs md:text-sm font-bold text-slate-700">Update RC Book (Optional)</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none">
                                        <FileText className="h-4 w-4 md:h-5 md:w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                                    </div>
                                    <input
                                        name="rcBook"
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={(e) => setRcBookFile(e.target.files[0])}
                                        className="block w-full pl-9 pr-3 py-1.5 md:py-2.5 border border-slate-200 rounded-xl text-xs md:text-sm text-slate-900 bg-slate-50 focus:bg-white transition-all font-medium shadow-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-100 file:text-teal-700 hover:file:bg-teal-200 cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs md:text-sm font-bold text-slate-700">Update Insurance Document (Optional)</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none">
                                        <FileText className="h-4 w-4 md:h-5 md:w-5 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                                    </div>
                                    <input
                                        name="insuranceDocument"
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={(e) => setInsuranceFile(e.target.files[0])}
                                        className="block w-full pl-9 pr-3 py-1.5 md:py-2.5 border border-slate-200 rounded-xl text-xs md:text-sm text-slate-900 bg-slate-50 focus:bg-white transition-all font-medium shadow-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-100 file:text-teal-700 hover:file:bg-teal-200 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-1/2 p-3 md:p-8 bg-slate-50/50">
                        <h3 className="text-sm md:text-lg font-bold text-slate-800 flex items-center gap-2 mb-3 md:mb-6"><Activity className="text-slate-400 h-4 w-4 md:h-5 md:w-5" /> Usage Baseline</h3>
                        <div className="space-y-3 md:space-y-6">
                            {renderInputGroup("Current Odometer (km)", "currentOdometerKm", "number", <Activity className="h-4 w-4 md:h-5 md:w-5" />, "e.g. 15000", null, { min: 0 })}
                            {renderInputGroup("Average Monthly Km", "averageMonthlyKm", "number", <Activity className="h-4 w-4 md:h-5 md:w-5" />, "e.g. 1000", null, { min: 0 })}
                        </div>
                    </div>
                </div>

                <div className="pt-2 flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-5 py-3 md:px-8 md:py-4 border border-transparent text-xs md:text-sm font-bold rounded-xl text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all shadow-md hover:shadow-xl disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading ? 'Saving Changes...' : (
                            <><Car className="h-4 w-4 md:h-5 md:w-5" /> Save Changes</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default EditVehicle;
