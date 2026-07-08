import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Car, Plus, History, Settings2, ShieldAlert, FileText, MoreVertical, Edit, Trash2, Activity, QrCode, ShieldCheck, UserPlus } from 'lucide-react';
import { API_BASE_URL } from '../utils/config';

const MyVehicles = () => {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState(null);
    const navigate = useNavigate();

    const fetchVehicles = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/vehicles/myvehicles`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setVehicles(res.data);
        } catch (err) {
            console.error('Error fetching vehicles:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVehicles();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this vehicle and all its service history?")) {
            try {
                const token = localStorage.getItem('token');
                await axios.delete(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/vehicles/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                fetchVehicles();
            } catch (err) {
                console.error('Error deleting vehicle:', err);
                alert('Failed to delete vehicle. Please try again.');
            }
        }
        setOpenMenuId(null);
    };

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pt-2 md:pt-0 pb-12 lg:pb-8">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 md:mb-8 gap-3">
                <div>
                    <h1 className="text-xl md:text-4xl font-extrabold text-slate-900 tracking-tight">My Vehicles</h1>
                    <p className="text-slate-500 mt-0.5 md:mt-2 font-medium text-xs md:text-lg">Manage and view details of your registered driveportz.</p>
                </div>
                <Link
                    to="/add-vehicle"
                    className="w-full sm:w-auto px-4 py-2 md:px-6 md:py-3 bg-teal-600 hover:bg-teal-700 text-white text-xs md:text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                    <Plus className="h-4 w-4 md:h-5 md:w-5" />
                    Add Vehicle
                </Link>
            </header>

            {loading ? (
                <div className="flex justify-center items-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-600"></div>
                </div>
            ) : vehicles.length === 0 ? (
                <div className="bg-white border border-slate-200 border-dashed rounded-2xl md:rounded-3xl p-6 md:p-16 text-center shadow-sm">
                    <div className="mx-auto h-16 w-16 md:h-24 md:w-24 bg-teal-50 rounded-full flex items-center justify-center border border-teal-100 mb-4 md:mb-6 shadow-sm">
                        <Car className="h-8 w-8 md:h-12 md:w-12 text-teal-400" />
                    </div>
                    <h3 className="text-lg md:text-2xl font-extrabold text-slate-900 mb-2">No Vehicles Found</h3>
                    <p className="text-slate-500 mb-6 max-w-md mx-auto font-medium text-xs md:text-lg">
                        You haven't registered any vehicles yet. Start building your driveportz fleet by adding your first vehicle.
                    </p>
                    <Link
                        to="/add-vehicle"
                        className="inline-flex items-center px-5 py-2.5 md:px-8 md:py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-all font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-transparent text-xs md:text-sm"
                    >
                        <Plus className="h-4 w-4 mr-1.5 md:h-5 md:w-5 md:mr-2" />
                        Add First Vehicle
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {vehicles.map((vehicle) => (
                        <div
                            key={vehicle.id}
                            className="bg-white border border-slate-100 rounded-2xl md:rounded-3xl overflow-hidden hover:border-teal-200 transition-all duration-300 group hover:-translate-y-1.5 hover:shadow-xl shadow-sm relative flex flex-col"
                        >
                            {/* Three Dot Context Menu */}
                            <div
                                className="absolute top-3.5 right-3.5 md:top-6 md:right-6 z-20"
                                onBlur={(e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget)) {
                                        setOpenMenuId(null);
                                    }
                                }}
                                tabIndex={-1}
                            >
                                <button
                                    onClick={() => setOpenMenuId(openMenuId === vehicle.id ? null : vehicle.id)}
                                    className="p-1.5 md:p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
                                >
                                    <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
                                </button>

                                {openMenuId === vehicle.id && (
                                    <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-2 text-xs md:text-sm origin-top-right animate-in fade-in zoom-in duration-200">
                                        <button
                                            onClick={() => navigate(`/passport/${vehicle.id}`)}
                                            className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-teal-600 flex items-center gap-2 font-medium transition-colors"
                                        >
                                            <QrCode className="h-4 w-4" /> View Passport
                                        </button>
                                        <button
                                            onClick={() => navigate(`/edit-vehicle/${vehicle.id}`)}
                                            className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-teal-600 flex items-center gap-2 font-medium transition-colors"
                                        >
                                            <Edit className="h-4 w-4" /> Edit Details
                                        </button>
                                        <button
                                            onClick={() => navigate(`/resale-report/${vehicle.id}`)}
                                            className="w-full text-left px-4 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2 font-medium transition-colors"
                                        >
                                            <ShieldAlert className="h-4 w-4" /> Trust Report
                                        </button>
                                        <button
                                            onClick={() => navigate(`/insurance/${vehicle.id}`)}
                                            className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-teal-600 flex items-center gap-2 font-medium transition-colors"
                                        >
                                            <ShieldCheck className="h-4 w-4" /> Manage Insurance
                                        </button>
                                        <button
                                            onClick={() => navigate(`/transfer/${vehicle.id}`)}
                                            className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-teal-600 flex items-center gap-2 font-medium transition-colors border-b border-slate-100 pb-3 mb-1"
                                        >
                                            <UserPlus className="h-4 w-4" /> Transfer Owner
                                        </button>
                                        <button
                                            onClick={() => handleDelete(vehicle.id)}
                                            className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" /> Delete Vehicle
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 md:p-6 lg:p-8 flex-1">
                                <div className="flex justify-between items-start mb-4 md:mb-6">
                                    <div className="p-2.5 md:p-4 bg-teal-50 rounded-xl md:rounded-2xl border border-teal-100 text-teal-600 group-hover:scale-110 group-hover:bg-teal-600 group-hover:text-white transition-all shadow-sm">
                                        <Car className="h-5 w-5 md:h-7 md:w-7" />
                                    </div>
                                    <span className="px-2.5 py-1 md:px-4 md:py-1.5 bg-slate-50 text-slate-655 border border-slate-200 rounded-full text-[10px] md:text-xs font-bold shadow-sm">
                                        {vehicle.year}
                                    </span>
                                </div>

                                <h3 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">
                                    {vehicle.brand ? `${vehicle.brand} ${vehicle.model}` : vehicle.model} {vehicle.variant && <span className="font-normal text-slate-550 text-sm md:text-lg">({vehicle.variant})</span>}
                                </h3>
                                <div className="flex items-center gap-1.5 md:gap-2 mt-1.5 mb-4 md:mb-6 flex-wrap">
                                    <span className="px-2.5 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold text-teal-600 bg-teal-50 border border-teal-100 rounded-lg whitespace-nowrap">
                                        {vehicle.vehicleNumber}
                                    </span>
                                    {vehicle.currentOdometerKm > 0 && (
                                        <span className="flex items-center px-2.5 py-0.5 md:px-3 md:py-1 text-[10px] md:text-xs font-bold text-slate-655 bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap">
                                            <Activity className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />
                                            {vehicle.currentOdometerKm.toLocaleString()} km
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3 md:gap-4 mb-2">
                                    <div className="flex flex-col p-2 md:p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] md:text-xs text-slate-400 font-bold mb-0.5 md:mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                                            <Settings2 className="h-3 w-3 md:h-3.5 md:w-3.5" /> Type
                                        </span>
                                        <span className="text-xs md:text-sm text-slate-900 font-bold">{vehicle.fuelType}</span>
                                    </div>
                                    <div className="flex flex-col p-2 md:p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] md:text-xs text-slate-400 font-bold mb-0.5 md:mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                                            <ShieldAlert className="h-3 w-3 md:h-3.5 md:w-3.5" /> Status
                                        </span>
                                        <span className="text-xs md:text-sm text-emerald-600 font-bold flex items-center gap-1.5">
                                            <span className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span> Active
                                        </span>
                                    </div>
                                </div>

                                {(vehicle.rcBookUrl || vehicle.insuranceDocumentUrl) && (
                                    <div className="mt-3 flex flex-wrap gap-1.5 md:gap-2">
                                        {vehicle.rcBookUrl && (
                                            <a
                                                href={`${API_BASE_URL}${vehicle.rcBookUrl}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[10px] md:text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1.5 rounded-lg border border-teal-100 hover:bg-teal-100 transition-colors"
                                            >
                                                <FileText className="h-3.5 w-3.5" />
                                                View RC
                                            </a>
                                        )}
                                        {vehicle.insuranceDocumentUrl && (
                                            <a
                                                href={`${API_BASE_URL}${vehicle.insuranceDocumentUrl}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[10px] md:text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors"
                                            >
                                                <FileText className="h-3.5 w-3.5" />
                                                Insurance
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="px-4 py-3 md:px-8 md:py-5 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center mt-auto">
                                <button
                                    onClick={() => navigate(`/service-history/${vehicle.id}`)}
                                    className="text-xs md:text-sm font-bold text-slate-655 hover:text-teal-600 flex items-center gap-1.5 transition-colors"
                                >
                                    <History className="h-4 w-4 md:h-4.5 md:w-4.5" />
                                    View History
                                </button>
                                <button
                                    onClick={() => navigate('/add-service')}
                                    className="text-xs md:text-sm font-bold text-white transition-all px-3 py-1.5 md:px-4 md:py-2 bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm hover:shadow-md"
                                >
                                    Add Service
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MyVehicles;
