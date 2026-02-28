import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { History, Wrench, Calendar, Hash, IndianRupee, ArrowLeft, Car, ShieldAlert, Building, CheckCircle, AlertTriangle, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const ServiceHistory = () => {
    const { vehicleId } = useParams();
    const [services, setServices] = useState([]);
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedService, setExpandedService] = useState(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const token = localStorage.getItem('token');

                // Fetch vehicles to get current vehicle details
                const vRes = await axios.get('http://localhost:5000/api/vehicles/myvehicles', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const currentVehicle = vRes.data.find(v => v.id === vehicleId);
                setVehicle(currentVehicle);

                // Fetch services for this vehicle
                const sRes = await axios.get(`http://localhost:5000/api/services/${vehicleId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setServices(sRes.data);
            } catch (err) {
                console.error('Error fetching service history:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [vehicleId]);

    const toggleExpand = (id) => {
        setExpandedService(expandedService === id ? null : id);
    };

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Link
                to="/my-vehicles"
                className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-blue-600 mb-6 transition-colors bg-white px-4 py-2 border border-slate-200 rounded-xl shadow-sm hover:shadow-md"
            >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Fleet
            </Link>

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4 bg-white border border-slate-100 p-8 rounded-3xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                    <History className="h-64 w-64 text-slate-900" />
                </div>

                <div className="relative z-10">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3 mb-2">
                        Production Service History
                    </h1>
                    {vehicle && (
                        <p className="text-blue-700 mt-2 font-bold bg-blue-50 inline-block px-4 py-1.5 rounded-full border border-blue-100 text-sm shadow-sm">
                            {vehicle.brand} {vehicle.model} • <span className="font-mono">{vehicle.vehicleNumber}</span>
                        </p>
                    )}
                </div>

                <Link
                    to="/add-service"
                    className="relative z-10 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2"
                >
                    <Wrench className="h-5 w-5" />
                    Log New Service
                </Link>
            </header>

            {loading ? (
                <div className="flex justify-center items-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-amber-500"></div>
                </div>
            ) : services.length === 0 ? (
                <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-16 text-center shadow-sm">
                    <div className="mx-auto h-24 w-24 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 mb-6 shadow-sm">
                        <Wrench className="h-12 w-12 text-amber-400" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-900 mb-3">No Operational Records</h3>
                    <p className="text-slate-500 mb-8 max-w-md mx-auto font-medium text-lg">
                        There are no production-grade service maintenance logs for this vehicle. Begin building out the service twin now.
                    </p>
                    <Link
                        to="/add-service"
                        className="inline-flex items-center px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-transparent"
                    >
                        <Wrench className="h-5 w-5 mr-2" />
                        Log First Production Record
                    </Link>
                </div>
            ) : (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-10 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                    {services.map((service, idx) => {
                        const isExpanded = expandedService === service.id;
                        return (
                            <div
                                key={service.id}
                                className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                            >
                                {/* Timeline Center Dot */}
                                <div className="flex items-center justify-center w-20 h-20 rounded-full shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl bg-white border-4 border-slate-50 z-10 transition-transform duration-300">
                                    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-sm">
                                        <Wrench className="h-6 w-6" />
                                    </div>
                                </div>

                                {/* Card Container */}
                                <div className="w-[calc(100%-6rem)] md:w-[calc(50%-4rem)] bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden relative">

                                    {/* Data Integrity Warning Tab */}
                                    {service.abnormalKmJump && (
                                        <div className="bg-red-50 px-6 py-2 border-b border-red-100 flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-red-600" />
                                            <span className="text-xs font-bold text-red-700">Data Integrity Flag: Abnormal Odometer Jump Detected</span>
                                        </div>
                                    )}

                                    <div className="p-6 cursor-pointer" onClick={() => toggleExpand(service.id)}>
                                        <div className="flex flex-col xl:flex-row justify-between xl:items-start mb-4 gap-2">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100 uppercase tracking-wide">
                                                        {service.serviceCategory}
                                                    </span>
                                                    {service.verifiedService && (
                                                        <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Verified
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-xl font-extrabold text-slate-900 group-hover:text-amber-600 transition-colors tracking-tight mt-1">
                                                    {service.serviceType}
                                                </h3>
                                            </div>
                                            <span className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full whitespace-nowrap self-start border border-slate-200 shadow-sm">
                                                {new Date(service.serviceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-x-6 gap-y-4 mb-5">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                    <Hash className="h-4 w-4 text-slate-500" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">{Number(service.odometerKm).toLocaleString()} km</span>
                                            </div>
                                            {service.garageName && (
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                        <Building className="h-4 w-4 text-slate-500" />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{service.garageName}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
                                            <div className="text-slate-400 font-bold flex items-center gap-1.5 text-sm hover:text-slate-600 transition-colors">
                                                {isExpanded ? <><ChevronUp className="h-4 w-4" /> Hide Details</> : <><ChevronDown className="h-4 w-4" /> View Full Report</>}
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Cost</span>
                                                <span className="text-2xl font-black text-slate-900 flex items-center tracking-tight">
                                                    <IndianRupee className="h-5 w-5 mr-0.5 text-slate-400" />
                                                    {Number(service.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details Section */}
                                    {isExpanded && (
                                        <div className="px-6 pb-6 bg-slate-50 border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">

                                            {/* Parts Table */}
                                            {service.partsReplaced && service.partsReplaced.length > 0 && (
                                                <div className="mt-6 mb-6">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <Wrench className="h-3.5 w-3.5" /> Parts / Materials Replaced
                                                    </h4>
                                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                        {service.partsReplaced.map((part, pIdx) => (
                                                            <div key={pIdx} className="flex justify-between items-center p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                                                <span className="text-sm font-bold text-slate-700">{part.partName}</span>
                                                                <span className="text-sm font-bold text-slate-900 flex items-center">
                                                                    <IndianRupee className="h-3 w-3 mr-0.5 text-slate-400" /> {Number(part.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {service.laborCost > 0 && (
                                                            <div className="flex justify-between items-center p-3 bg-slate-50 border-t border-slate-200 text-sm">
                                                                <span className="font-bold text-slate-500">Labor Charges</span>
                                                                <span className="font-bold text-slate-700 flex items-center">
                                                                    <IndianRupee className="h-3 w-3 mr-0.5 text-slate-400" /> {Number(service.laborCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Notes Area */}
                                            {service.mechanicNotes && (
                                                <div className="mt-6">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                        <FileText className="h-3.5 w-3.5" /> Mechanic Notes
                                                    </h4>
                                                    <p className="text-sm text-slate-600 bg-white p-4 rounded-xl border border-slate-200 shadow-sm font-medium leading-relaxed italic">
                                                        "{service.mechanicNotes}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* Recommendations Area */}
                                            {(service.recommendedKm || service.recommendedDate) && (
                                                <div className="mt-6 flex flex-wrap gap-4">
                                                    {service.recommendedKm && (
                                                        <div className="flex-1 bg-blue-50 border border-blue-100 p-3 rounded-xl">
                                                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block mb-1">Next Service (Km)</span>
                                                            <span className="text-sm font-black text-blue-800">{Number(service.recommendedKm).toLocaleString()} km</span>
                                                        </div>
                                                    )}
                                                    {service.recommendedDate && (
                                                        <div className="flex-1 bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                                                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Next Service (Date)</span>
                                                            <span className="text-sm font-black text-emerald-800">
                                                                {new Date(service.recommendedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ServiceHistory;
