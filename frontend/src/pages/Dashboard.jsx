import { useEffect, useState } from 'react';
import axios from 'axios';
import { Car, Activity, Wrench, Settings, TrendingUp } from 'lucide-react';

const Dashboard = () => {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/vehicles/myvehicles', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setVehicles(res.data);
            } catch (err) {
                console.error('Failed to fetch dashboard data', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex justify-between items-end mb-8 bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
                {/* Subtle decorative background in header */}
                <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-blue-50 to-transparent"></div>
                <div className="relative z-10">
                    <div className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold tracking-wide mb-3 border border-blue-100 shadow-sm">
                        Overview Dashboard
                    </div>
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                        Welcome back, {user.name}
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium text-lg">
                        Here's the latest status of your digital twin fleet.
                    </p>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardCard
                    title="Total Vehicles"
                    value={loading ? '-' : vehicles.length.toString()}
                    icon={<Car className="h-6 w-6 text-blue-600" />}
                    color="blue"
                    trend="+1 this month"
                />
                <DashboardCard
                    title="Active Alerts"
                    value="0"
                    icon={<Activity className="h-6 w-6 text-rose-600" />}
                    color="rose"
                    trend="Looking good"
                />
                <DashboardCard
                    title="Upcoming Services"
                    value="0"
                    icon={<Wrench className="h-6 w-6 text-amber-600" />}
                    color="amber"
                    trend="All up to date"
                />
                <DashboardCard
                    title="System Health"
                    value="100%"
                    icon={<Settings className="h-6 w-6 text-emerald-600" />}
                    color="emerald"
                    trend="Optimal performance"
                />
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-blue-500" />
                        Recent Fleet Activity
                    </h2>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    </div>
                ) : vehicles.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed">
                        <div className="mx-auto h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                            <Car className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="text-slate-900 font-semibold text-lg">No vehicles registered yet.</p>
                        <p className="text-slate-500 mt-1 font-medium">Add your first vehicle to start building your digital twin.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {vehicles.slice(0, 5).map(v => (
                            <div key={v.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all duration-300 group cursor-pointer">
                                <div className="flex items-center gap-5">
                                    <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors">
                                        <Car className="h-6 w-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                    </div>
                                    <div>
                                        <p className="text-slate-900 font-bold text-lg">{v.model} <span className="text-slate-400 font-normal text-sm ml-1">({v.year})</span></p>
                                        <p className="text-slate-500 font-medium text-sm mt-0.5">{v.vehicleNumber} • {v.fuelType}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold shadow-sm shadow-emerald-100/50">
                                        Active Twin
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const DashboardCard = ({ title, value, icon, color, trend }) => {
    const getColorStyles = () => {
        switch (color) {
            case 'blue': return 'bg-blue-50 border-blue-100 hover:border-blue-300';
            case 'rose': return 'bg-rose-50 border-rose-100 hover:border-rose-300';
            case 'amber': return 'bg-amber-50 border-amber-100 hover:border-amber-300';
            case 'emerald': return 'bg-emerald-50 border-emerald-100 hover:border-emerald-300';
            default: return 'bg-slate-50 border-slate-100 hover:border-slate-300';
        }
    };

    return (
        <div className={`bg-white rounded-3xl p-6 border border-slate-100 relative overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-lg group cursor-default`}>
            <div className="flex items-start justify-between mb-6">
                <div className={`p-3 rounded-2xl border transition-colors ${getColorStyles()}`}>
                    {icon}
                </div>
                <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                    {trend}
                </span>
            </div>
            <div>
                <h3 className="text-slate-500 font-semibold mb-1">{title}</h3>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">{value}</p>
            </div>
        </div>
    );
};

export default Dashboard;
