import { apiGet } from '../../utils/api';
import { useAsync } from '../../hooks/useAsync';
import ErrorState from '../../components/common/ErrorState';
import { Users, Building2, Car, Wrench, IndianRupee, ShieldCheck, Activity, TrendingUp } from 'lucide-react';
import StatsCard from '../../components/admin/StatsCard';

const AdminDashboard = () => {
    const { data: stats, loading, error, refetch } = useAsync(() => apiGet('/admin/dashboard'), []);

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse">
                <div className="h-8 bg-slate-200/60 rounded-lg w-64"></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-32 bg-white rounded-2xl border border-slate-100"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <ErrorState title="Failed to load dashboard" message={error} onRetry={() => refetch()} className="max-w-lg w-full" />
            </div>
        );
    }

    const cards = [
        {
            icon: Users,
            title: 'Total Users',
            value: stats?.totalUsers || 0,
            accentColor: 'teal',
            subtitle: 'Registered platform users'
        },
        {
            icon: Building2,
            title: 'Total Garages',
            value: stats?.totalGarages || 0,
            accentColor: 'cyan',
            subtitle: 'Active service centers'
        },
        {
            icon: Car,
            title: 'Total Vehicles',
            value: stats?.totalVehicles || 0,
            accentColor: 'sky',
            subtitle: 'Registered vehicles'
        },
        {
            icon: Wrench,
            title: 'Total Services',
            value: stats?.totalServices || 0,
            accentColor: 'emerald',
            subtitle: 'Service records created'
        },
        {
            icon: IndianRupee,
            title: 'Total Revenue',
            value: stats?.totalRevenue || 0,
            prefix: '₹',
            accentColor: 'amber',
            subtitle: 'From completed bookings'
        },
        {
            icon: ShieldCheck,
            title: 'Verified Garages',
            value: stats?.verifiedGarages || 0,
            accentColor: 'rose',
            subtitle: `Out of ${stats?.totalGarages || 0} total`
        }
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-500/20 shrink-0">
                        <TrendingUp className="h-4 w-4 text-slate-900" />
                    </div>
                    Dashboard Overview
                </h1>
                <p className="text-slate-500 text-sm mt-1.5 ml-12">
                    Real-time platform metrics and activity
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {cards.map((card) => (
                    <StatsCard key={card.title} {...card} />
                ))}
            </div>

            {/* Quick Info Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-2xl bg-white border border-slate-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <h3 className="text-slate-900 font-bold text-base mb-4 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-teal-600" />
                        Platform Health
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-sm">Garage Verification Rate</span>
                            <div className="flex items-center gap-3">
                                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-1000"
                                        style={{
                                            width: `${stats?.totalGarages
                                                ? Math.round((stats.verifiedGarages / stats.totalGarages) * 100)
                                                : 0}%`
                                        }}
                                    ></div>
                                </div>
                                <span className="text-slate-900 text-sm font-bold w-10 text-right">
                                    {stats?.totalGarages
                                        ? Math.round((stats.verifiedGarages / stats.totalGarages) * 100)
                                        : 0}%
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-sm">Avg Vehicles per User</span>
                            <span className="text-slate-900 text-sm font-bold">
                                {stats?.totalUsers
                                    ? (stats.totalVehicles / stats.totalUsers).toFixed(1)
                                    : '0'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-sm">Avg Services per Vehicle</span>
                            <span className="text-slate-900 text-sm font-bold">
                                {stats?.totalVehicles
                                    ? (stats.totalServices / stats.totalVehicles).toFixed(1)
                                    : '0'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <h3 className="text-slate-900 font-bold text-base mb-4 flex items-center gap-2">
                        <IndianRupee className="h-4 w-4 text-amber-600" />
                        Revenue Summary
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-sm">Total Platform Revenue</span>
                            <span className="text-slate-900 text-sm font-bold">
                                ₹{(stats?.totalRevenue || 0).toLocaleString('en-IN')}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-sm">Avg Revenue per Garage</span>
                            <span className="text-slate-900 text-sm font-bold">
                                ₹{stats?.totalGarages
                                    ? Math.round(stats.totalRevenue / stats.totalGarages).toLocaleString('en-IN')
                                    : '0'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-sm">Revenue per Service</span>
                            <span className="text-slate-900 text-sm font-bold">
                                ₹{stats?.totalServices
                                    ? Math.round(stats.totalRevenue / stats.totalServices).toLocaleString('en-IN')
                                    : '0'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
