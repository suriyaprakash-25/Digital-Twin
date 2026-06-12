import { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart3, Users, Car, Wrench, TrendingUp, Award } from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const CHART_COLORS = [
    '#0d9488', '#14b8a6', '#0f766e', '#06b6d4', '#0891b2',
    '#059669', '#10b981', '#0e7490', '#115e59', '#047857'
];

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-lg">
            <p className="text-slate-900 text-sm font-semibold mb-1">{label}</p>
            {payload.map((p, i) => (
                <p key={i} className="text-slate-600 text-xs">
                    {p.name}:{' '}
                    <span className="font-bold" style={{ color: p.color }}>
                        {p.name === 'Revenue'
                            ? `₹${(p.value || 0).toLocaleString('en-IN')}`
                            : (p.value || 0).toLocaleString('en-IN')
                        }
                    </span>
                </p>
            ))}
        </div>
    );
};

const ChartCard = ({ title, icon: Icon, iconColor, children }) => (
    <div className="rounded-2xl bg-white border border-slate-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <h3 className="text-slate-900 font-bold text-base mb-6 flex items-center gap-2">
            <Icon className={`h-4 w-4 ${iconColor}`} />
            {title}
        </h3>
        <div className="h-72">
            {children}
        </div>
    </div>
);

const formatMonth = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = parseInt(month, 10);
    return `${months[m - 1] || month} '${year?.slice(2)}`;
};

const AdminAnalytics = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/admin/analytics', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data);
            } catch (err) {
                setError(err.response?.data?.msg || 'Failed to load analytics');
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 bg-slate-200/60 rounded-lg w-48"></div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-80 bg-white rounded-2xl border border-slate-100"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
                        <BarChart3 className="h-8 w-8 text-red-400" />
                    </div>
                    <h3 className="text-slate-900 font-bold text-lg mb-1">Failed to load analytics</h3>
                    <p className="text-slate-500 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    const monthlyUsers = (data?.monthlyUsers || []).map((d) => ({ ...d, month: formatMonth(d.month) }));
    const monthlyVehicles = (data?.monthlyVehicles || []).map((d) => ({ ...d, month: formatMonth(d.month) }));
    const monthlyServices = (data?.monthlyServices || []).map((d) => ({ ...d, month: formatMonth(d.month) }));
    const monthlyRevenue = (data?.monthlyRevenue || []).map((d) => ({ ...d, month: formatMonth(d.month) }));
    const topGarages = data?.topGarages || [];

    const hasData = (arr) => arr.length > 0;

    const EmptyChart = ({ message }) => (
        <div className="flex items-center justify-center h-full">
            <p className="text-slate-400 text-sm">{message}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-500/20">
                        <BarChart3 className="h-4.5 w-4.5 text-white" />
                    </div>
                    Platform Analytics
                </h1>
                <p className="text-slate-500 text-sm mt-1 ml-12">
                    Historical trends and performance metrics
                </p>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly User Registrations */}
                <ChartCard title="Monthly User Registrations" icon={Users} iconColor="text-teal-600">
                    {hasData(monthlyUsers) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyUsers}>
                                <defs>
                                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#0d9488" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#0d9488', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    name="Users"
                                    stroke="#0d9488"
                                    strokeWidth={2.5}
                                    fill="url(#gradUsers)"
                                    dot={{ r: 4, fill: '#0d9488', strokeWidth: 0 }}
                                    activeDot={{ r: 6, fill: '#14b8a6', strokeWidth: 2, stroke: '#0d9488' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart message="No user registration data yet" />}
                </ChartCard>

                {/* Monthly Vehicle Registrations */}
                <ChartCard title="Monthly Vehicle Registrations" icon={Car} iconColor="text-sky-600">
                    {hasData(monthlyVehicles) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyVehicles}>
                                <defs>
                                    <linearGradient id="gradVehicles" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#0284c7" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#0284c7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#0284c7', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    name="Vehicles"
                                    stroke="#0284c7"
                                    strokeWidth={2.5}
                                    fill="url(#gradVehicles)"
                                    dot={{ r: 4, fill: '#0284c7', strokeWidth: 0 }}
                                    activeDot={{ r: 6, fill: '#38bdf8', strokeWidth: 2, stroke: '#0284c7' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart message="No vehicle registration data yet" />}
                </ChartCard>

                {/* Monthly Service Records */}
                <ChartCard title="Monthly Service Records" icon={Wrench} iconColor="text-emerald-600">
                    {hasData(monthlyServices) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyServices}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(13,148,136,0.04)' }} />
                                <Bar
                                    dataKey="count"
                                    name="Services"
                                    fill="#059669"
                                    radius={[6, 6, 0, 0]}
                                    barSize={32}
                                    fillOpacity={0.85}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart message="No service record data yet" />}
                </ChartCard>

                {/* Revenue Growth */}
                <ChartCard title="Revenue Growth" icon={TrendingUp} iconColor="text-amber-600">
                    {hasData(monthlyRevenue) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthlyRevenue}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#d97706', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Line
                                    type="monotone"
                                    dataKey="revenue"
                                    name="Revenue"
                                    stroke="#d97706"
                                    strokeWidth={2.5}
                                    dot={{ r: 4, fill: '#d97706', strokeWidth: 0 }}
                                    activeDot={{ r: 6, fill: '#fbbf24', strokeWidth: 2, stroke: '#d97706' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <EmptyChart message="No revenue data yet" />}
                </ChartCard>
            </div>

            {/* Top Performing Garages — Full Width */}
            <ChartCard title="Top Performing Garages" icon={Award} iconColor="text-amber-600">
                {topGarages.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topGarages} layout="vertical" margin={{ left: 20, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis
                                type="number"
                                tick={{ fill: '#64748b', fontSize: 12 }}
                                tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                            />
                            <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fill: '#334155', fontSize: 12 }}
                                width={150}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(13,148,136,0.04)' }} />
                            <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]} barSize={22}>
                                {topGarages.map((_, index) => (
                                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : <EmptyChart message="No garage performance data yet" />}
            </ChartCard>
        </div>
    );
};

export default AdminAnalytics;
