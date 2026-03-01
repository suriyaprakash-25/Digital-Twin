import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Car, Plus, History, Settings2, ShieldAlert, FileText, MoreVertical, Edit, Trash2, Activity } from 'lucide-react';

const MyVehicles = () => {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openMenuId, setOpenMenuId] = useState(null);
    const navigate = useNavigate();

    const fetchVehicles = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5000/api/vehicles/myvehicles', {
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
                await axios.delete(`http://localhost:5000/api/vehicles/${id}`, {
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
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">My Vehicles</h1>
                    <p className="text-slate-500 mt-2 font-medium text-lg">Manage and view details of your registered digital twins.</p>
                </div>
                <Link
                    to="/add-vehicle"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2"
                >
                    <Plus className="h-5 w-5" />
                    Add Vehicle
                </Link>
            </header>

            {loading ? (
                <div className="flex justify-center items-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
                </div>
            ) : vehicles.length === 0 ? (
                <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-16 text-center shadow-sm">
                    <div className="mx-auto h-24 w-24 bg-blue-50 rounded-full flex items-center justify-center border border-blue-100 mb-6 shadow-sm">
                        <Car className="h-12 w-12 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-slate-900 mb-3">No Vehicles Found</h3>
                    <p className="text-slate-500 mb-8 max-w-md mx-auto font-medium text-lg">
                        You haven't registered any vehicles yet. Start building your digital twin fleet by adding your first vehicle.
                    </p>
                    <Link
                        to="/add-vehicle"
                        className="inline-flex items-center px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 border border-transparent"
                    >
                        <Plus className="h-5 w-5 mr-2" />
                        Add First Vehicle
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {vehicles.map((vehicle) => (
                        <div
                            key={vehicle.id}
                            className="bg-white border border-slate-100 rounded-3xl overflow-hidden hover:border-blue-200 transition-all duration-300 group hover:-translate-y-1.5 hover:shadow-xl shadow-sm relative flex flex-col"
                        >
                            {/* Three Dot Context Menu */}
                            <div
                                className="absolute top-6 right-6 z-20"
                                onBlur={(e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget)) {
                                        setOpenMenuId(null);
                                    }
                                }}
                                tabIndex={-1}
                            >
                                <button
                                    onClick={() => setOpenMenuId(openMenuId === vehicle.id ? null : vehicle.id)}
                                    className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
                                >
                                    <MoreVertical className="h-5 w-5" />
                                </button>

                                {openMenuId === vehicle.id && (
                                    <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-slate-100 py-2 sm:text-sm origin-top-right animate-in fade-in zoom-in duration-200">
                                        <button
                                            onClick={() => navigate(`/edit-vehicle/${vehicle.id}`)}
                                            className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 font-medium transition-colors"
                                        >
                                            <Edit className="h-4 w-4" /> Edit Details
                                        </button>
                                        <button
                                            onClick={() => navigate(`/resale-report/${vehicle.id}`)}
                                            className="w-full text-left px-4 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2 font-medium transition-colors border-b border-slate-100 pb-3 mb-1"
                                        >
                                            <ShieldAlert className="h-4 w-4" /> Trust Report
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

                            <div className="p-8 flex-1">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                        <Car className="h-7 w-7" />
                                    </div>
                                    <span className="px-4 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-full text-xs font-bold shadow-sm">
                                        {vehicle.year}
                                    </span>
                                </div>

                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                                    {vehicle.brand ? `${vehicle.brand} ${vehicle.model}` : vehicle.model} {vehicle.variant && <span className="font-normal text-slate-500 text-lg">({vehicle.variant})</span>}
                                </h3>
                                <div className="flex items-center gap-2 mt-2 mb-8 flex-wrap">
                                    <span className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg whitespace-nowrap">
                                        {vehicle.vehicleNumber}
                                    </span>
                                    {vehicle.currentOdometerKm > 0 && (
                                        <span className="flex items-center px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap">
                                            <Activity className="h-3.5 w-3.5 mr-1" />
                                            {vehicle.currentOdometerKm.toLocaleString()} km
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-2">
                                    <div className="flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                                            <Settings2 className="h-3.5 w-3.5" /> Type
                                        </span>
                                        <span className="text-sm text-slate-900 font-bold">{vehicle.fuelType}</span>
                                    </div>
                                    <div className="flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-xs text-slate-400 font-bold mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                                            <ShieldAlert className="h-3.5 w-3.5" /> Status
                                        </span>
                                        <span className="text-sm text-emerald-600 font-bold flex items-center gap-1.5">
                                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span> Active
                                        </span>
                                    </div>
                                </div>

                                {vehicle.rcBookUrl && (
                                    <div className="mt-4">
                                        <a
                                            href={`http://localhost:5000${vehicle.rcBookUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors"
                                        >
                                            <FileText className="h-4 w-4" />
                                            View RC Book
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div className="px-8 py-5 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center mt-auto">
                                <button
                                    onClick={() => navigate(`/service-history/${vehicle.id}`)}
                                    className="text-sm font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1.5 transition-colors"
                                >
                                    <History className="h-4.5 w-4.5" />
                                    View History
                                </button>
                                <button
                                    onClick={() => navigate('/add-service')}
                                    className="text-sm font-bold text-white transition-all px-4 py-2 bg-slate-900 hover:bg-blue-600 rounded-lg shadow-sm hover:shadow-md"
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
