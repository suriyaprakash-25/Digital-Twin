import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Car, CheckCircle, Hash, Calendar, Fuel, FileText, User, Phone, IndianRupee, Activity, Tag, Shield, FileCheck, Layers } from 'lucide-react';

const AddVehicle = () => {
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
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

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

            await axios.post('http://localhost:5000/api/vehicles/add', submitData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setStatus({ type: 'success', message: 'Vehicle added successfully!' });
            setTimeout(() => navigate('/my-vehicles'), 1500);
        } catch (err) {
            setStatus({
                type: 'error',
                message: err.response?.data?.msg || 'Failed to add vehicle. Please try again.'
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
                        required={extraProps.required}
                        className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium hover:border-slate-300 shadow-sm appearance-none cursor-pointer"
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
                        className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium hover:border-slate-300 shadow-sm"
                    />
                )}
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-8">
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Register Vehicle</h1>
                <p className="text-slate-500 mt-2 font-medium text-lg">Create a comprehensive digital twin with production-grade lifecycle tracking.</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-8">
                {status.message && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold shadow-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {status.type === 'success' && <CheckCircle className="h-5 w-5" />}
                        {status.message}
                    </div>
                )}

                {/* Identity Details */}
                <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="bg-blue-50 px-8 py-5 border-b border-blue-100 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Car /></div>
                        <h2 className="text-xl font-bold text-slate-800">Identity Details</h2>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {renderInputGroup("Vehicle Number *", "vehicleNumber", "text", <Hash className="h-5 w-5" />, "e.g. MH12AB1234", null, { required: true })}
                        {renderInputGroup("Vehicle Type", "vehicleType", "text", <Layers className="h-5 w-5" />, "", ["Commercial", "Car", "Bike", "Truck"])}
                        {renderInputGroup("Brand", "brand", "text", <Tag className="h-5 w-5" />, "e.g. Honda")}
                        {renderInputGroup("Model Name *", "model", "text", <Car className="h-5 w-5" />, "e.g. City", null, { required: true })}
                        {renderInputGroup("Variant", "variant", "text", <Layers className="h-5 w-5" />, "e.g. VX CVT")}
                        {renderInputGroup("Fuel Type *", "fuelType", "text", <Fuel className="h-5 w-5" />, "", ["Petrol", "Diesel", "Electric", "Hybrid", "CNG"], { required: true })}
                        {renderInputGroup("Color", "color", "text", <Tag className="h-5 w-5" />, "e.g. Lunar Silver")}
                        {renderInputGroup("Manufacturing Year *", "year", "number", <Calendar className="h-5 w-5" />, "e.g. 2021", null, { required: true, min: "1900", max: new Date().getFullYear() + 1 })}
                        {renderInputGroup("Registration Date", "registrationDate", "date", <Calendar className="h-5 w-5" />)}
                        {renderInputGroup("Registered RTO", "registeredRTO", "text", <CheckCircle className="h-5 w-5" />, "e.g. Pune RTO")}
                    </div>
                </div>

                {/* Ownership Details */}
                <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="bg-indigo-50 px-8 py-5 border-b border-indigo-100 flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><User /></div>
                        <h2 className="text-xl font-bold text-slate-800">Ownership Details</h2>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {renderInputGroup("Owner Name", "ownerName", "text", <User className="h-5 w-5" />, "e.g. John Doe")}
                        {renderInputGroup("Phone Number", "phone", "tel", <Phone className="h-5 w-5" />, "e.g. 9876543210")}
                        {renderInputGroup("Ownership Count", "ownershipCount", "number", <Hash className="h-5 w-5" />, "1", null, { min: 1 })}
                        {renderInputGroup("Purchase Date", "purchaseDate", "date", <Calendar className="h-5 w-5" />)}
                        {renderInputGroup("Purchase Price (₹)", "purchasePrice", "number", <IndianRupee className="h-5 w-5" />, "e.g. 1000000")}
                    </div>
                </div>

                {/* Legal & Validity */}
                <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="bg-emerald-50 px-8 py-5 border-b border-emerald-100 flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Shield /></div>
                        <h2 className="text-xl font-bold text-slate-800">Legal Validity (Expiries)</h2>
                    </div>
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {renderInputGroup("Insurance Provider", "insuranceProvider", "text", <Shield className="h-5 w-5" />, "e.g. HDFC ERGO")}
                        {renderInputGroup("Insurance Expiry", "insuranceExpiry", "date", <Calendar className="h-5 w-5" />)}
                        {renderInputGroup("PUC Expiry", "pucExpiry", "date", <Calendar className="h-5 w-5" />)}
                        {renderInputGroup("RC Expiry", "rcExpiry", "date", <Calendar className="h-5 w-5" />)}
                        {renderInputGroup("Road Tax Valid Till", "roadTaxValidTill", "date", <Calendar className="h-5 w-5" />)}
                        {renderInputGroup("Fitness Expiry", "fitnessExpiry", "date", <Calendar className="h-5 w-5" />)}
                    </div>
                </div>

                {/* Verification & Usage */}
                <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                    <div className="w-full md:w-1/2 p-8">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6"><FileCheck className="text-slate-400" /> Verification Details</h3>
                        <div className="space-y-6">
                            {renderInputGroup("Chassis Number", "chassisNumber", "text", <Hash className="h-5 w-5" />, "17-digit VIN")}
                            {renderInputGroup("Engine Number", "engineNumber", "text", <Hash className="h-5 w-5" />, "")}

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">RC Book Document (Optional)</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <FileText className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        name="rcBook"
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={(e) => setRcBookFile(e.target.files[0])}
                                        className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-slate-50 focus:bg-white transition-all font-medium shadow-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-1/2 p-8 bg-slate-50/50">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6"><Activity className="text-slate-400" /> Usage Baseline</h3>
                        <div className="space-y-6">
                            {renderInputGroup("Current Odometer (km)", "currentOdometerKm", "number", <Activity className="h-5 w-5" />, "e.g. 15000", null, { min: 0 })}
                            {renderInputGroup("Average Monthly Km", "averageMonthlyKm", "number", <Activity className="h-5 w-5" />, "e.g. 1000", null, { min: 0 })}
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-8 py-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-md hover:shadow-xl disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading ? 'Registering...' : (
                            <><Car className="h-5 w-5" /> Register Complete Profiling</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddVehicle;
