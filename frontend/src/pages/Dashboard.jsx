import { useEffect, useState } from 'react';
import axios from 'axios';
import { Car, Activity, Wrench, Settings, TrendingUp } from 'lucide-react';

const Dashboard = () => {
    const [vehicles, setVehicles] = useState([]);
    const [reminders, setReminders] = useState([]);
    const [healthData, setHealthData] = useState({});
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const token = localStorage.getItem('token');

                // Fetch vehicles
                const vehiclesRes = await axios.get('http://localhost:5000/api/vehicles/myvehicles', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const fetchedVehicles = vehiclesRes.data;
                setVehicles(fetchedVehicles);

                // Fetch reminders
                const remindersRes = await axios.get('http://localhost:5000/api/reminders', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setReminders(remindersRes.data);

                // Fetch health data for each vehicle
                const healthPromises = fetchedVehicles.map(v =>
                    axios.get(`http://localhost:5000/api/health/${v.id}`, { headers: { Authorization: `Bearer ${token}` } })
                        .catch(() => ({ data: { healthScore: 100 } })) // Fallback on error
                );

                const healthResponses = await Promise.all(healthPromises);
                const healthMap = {};
                healthResponses.forEach((res, index) => {
                    healthMap[fetchedVehicles[index].id] = res.data;
                });
                setHealthData(healthMap);

            } catch (err) {
                console.error('Failed to fetch dashboard data', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    // Derived statistics
    const activeAlertsCount = reminders.filter(r => r.status === 'overdue' || r.priority === 'critical' || r.priority === 'high').length;
    const upcomingServicesCount = reminders.filter(r => r.type === 'service').length;

    let avgHealth = 0;
    if (vehicles.length > 0) {
        const total = Object.values(healthData).reduce((sum, h) => sum + (h.healthScore || 100), 0);
        avgHealth = Math.round(total / vehicles.length);
    }

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
                    trend={vehicles.length > 0 ? "Active Fleet" : "Add one to start"}
                />
                <DashboardCard
                    title="Active Alerts"
                    value={loading ? '-' : activeAlertsCount.toString()}
                    icon={<Activity className={`h-6 w-6 ${activeAlertsCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />}
                    color={activeAlertsCount > 0 ? "rose" : "slate"}
                    trend={activeAlertsCount > 0 ? "Requires action" : "Looking good"}
                />
                <DashboardCard
                    title="Upcoming Services"
                    value={loading ? '-' : upcomingServicesCount.toString()}
                    icon={<Wrench className={`h-6 w-6 ${upcomingServicesCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />}
                    color={upcomingServicesCount > 0 ? "amber" : "slate"}
                    trend={upcomingServicesCount > 0 ? "Schedule soon" : "All up to date"}
                />
                <DashboardCard
                    title="System Health"
                    value={loading ? '-' : `${avgHealth}%`}
                    icon={<Settings className="h-6 w-6 text-emerald-600" />}
                    color={avgHealth >= 80 ? 'emerald' : avgHealth >= 50 ? 'amber' : 'rose'}
                    trend={avgHealth >= 80 ? 'Optimal performance' : 'Needs attention'}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Reminders List */}
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Activity className="h-6 w-6 text-rose-500" />
                            Smart Reminders
                        </h2>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600"></div>
                        </div>
                    ) : reminders.length === 0 ? (
                        <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed">
                            <p className="text-slate-900 font-semibold text-lg">No pending reminders.</p>
                            <p className="text-slate-500 mt-1 font-medium">Your fleet is completely up to date.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {reminders.slice(0, 5).map(r => (
                                <div key={r.id} className={`flex flex-col p-5 bg-white rounded-2xl border ${r.priority === 'critical' ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'} hover:border-rose-200 hover:shadow-md transition-all`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-slate-900">{r.title}</h4>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${r.status === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {r.status === 'overdue' ? 'OVERDUE' : `${r.daysRemaining} days`}
                                        </span>
                                    </div>
                                    <p className="text-slate-600 text-sm font-medium">{r.vehicleName} ({r.vehicleNumber})</p>
                                    <p className="text-slate-400 text-xs mt-1">Due: {new Date(r.dueDate).toLocaleDateString()}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Fleet Details with Health Scores */}
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp className="h-6 w-6 text-blue-500" />
                            Fleet Health
                        </h2>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : vehicles.length === 0 ? (
                        <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-slate-200 border-dashed">
                            <Car className="h-8 w-8 text-slate-400 mx-auto mb-4" />
                            <p className="text-slate-900 font-semibold text-lg">No vehicles registered.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {vehicles.slice(0, 5).map(v => {
                                const h = healthData[v.id] || { healthScore: 100, conditionLevel: 'Excellent' };
                                const scoreColor = h.healthScore >= 80 ? 'text-emerald-600' : h.healthScore >= 50 ? 'text-amber-600' : 'text-rose-600';
                                const barColor = h.healthScore >= 80 ? 'bg-emerald-500' : h.healthScore >= 50 ? 'bg-amber-500' : 'bg-rose-500';

                                return (
                                    <div key={v.id} className="flex flex-col p-5 bg-white rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group">
                                        <div className="flex justify-between items-center mb-3">
                                            <div>
                                                <p className="text-slate-900 font-bold text-lg">{v.brand} {v.model}</p>
                                                <p className="text-slate-500 font-medium text-xs mt-0.5">{v.vehicleNumber}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-2xl font-black tracking-tight ${scoreColor}`}>{h.healthScore}</p>
                                                <p className="text-slate-400 text-xs font-bold uppercase">{h.conditionLevel}</p>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1 overflow-hidden">
                                            <div className={`${barColor} h-2.5 rounded-full transition-all duration-1000`} style={{ width: `${h.healthScore}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
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
