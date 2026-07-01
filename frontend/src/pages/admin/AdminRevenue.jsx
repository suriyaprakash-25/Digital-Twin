import { useEffect, useState } from 'react';
import axios from 'axios';
import { IndianRupee, Building2, TrendingUp, Award, ShieldCheck } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
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
                    {p.name}: <span className="text-amber-600 font-bold">₹{(p.value || 0).toLocaleString('en-IN')}</span>
                </p>
            ))}
        </div>
    );
};

const AdminRevenue = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchRevenue = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/revenue`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data);
            } catch (err) {
                setError(err.response?.data?.msg || 'Failed to load revenue');
            } finally {
                setLoading(false);
            }
        };
        fetchRevenue();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 bg-slate-200/60 rounded-lg w-64"></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100"></div>)}
                </div>
                <div className="h-80 bg-white rounded-2xl border border-slate-100"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
                        <IndianRupee className="h-8 w-8 text-red-400" />
                    </div>
                    <h3 className="text-slate-900 font-bold text-lg mb-1">Failed to load revenue</h3>
                    <p className="text-slate-500 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    const items = data?.items || [];
    const chartData = items.slice(0, 10).map((item) => ({
        name: item.garageName?.length > 20 ? item.garageName.slice(0, 20) + '…' : item.garageName,
        revenue: item.totalRevenue || 0,
        services: item.totalServices || 0
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-500/20">
                        <IndianRupee className="h-4.5 w-4.5 text-white" />
                    </div>
                    Revenue Reports
                </h1>
                <p className="text-slate-500 text-sm mt-1 ml-12">
                    Revenue breakdown by garage, sorted by highest earnings
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="rounded-2xl bg-white border border-amber-200/60 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                            <IndianRupee className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Grand Total</p>
                            <p className="text-slate-900 text-xl font-extrabold">₹{(data?.grandTotal || 0).toLocaleString('en-IN')}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl bg-white border border-emerald-200/60 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Services</p>
                            <p className="text-slate-900 text-xl font-extrabold">{(data?.totalServices || 0).toLocaleString('en-IN')}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl bg-white border border-teal-200/60 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Earning Garages</p>
                            <p className="text-slate-900 text-xl font-extrabold">{data?.totalGarages || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
                <div className="rounded-2xl bg-white border border-slate-200 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <h3 className="text-slate-900 font-bold text-base mb-6 flex items-center gap-2">
                        <Award className="h-4 w-4 text-amber-600" />
                        Top 10 Garages by Revenue
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#334155', fontSize: 12 }} width={160} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(13,148,136,0.04)' }} />
                                <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]} barSize={24}>
                                    {chartData.map((_, index) => (
                                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                            <IndianRupee className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-slate-900 font-bold text-lg">No revenue data yet</h3>
                        <p className="text-slate-500 text-sm mt-1">Revenue will appear once bookings are completed</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4 w-16">#</th>
                                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Garage</th>
                                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">City</th>
                                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Services</th>
                                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={item.garageId} className="border-b border-slate-50 hover:bg-teal-50/30 transition-colors">
                                        <td className="px-6 py-4 text-center">
                                            {index < 3 ? (
                                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${index === 0
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : index === 1
                                                        ? 'bg-slate-200 text-slate-600'
                                                        : 'bg-orange-100 text-orange-600'
                                                    }`}>
                                                    {index + 1}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-sm">{index + 1}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-slate-900 text-sm font-semibold flex items-center gap-1.5">
                                                {item.garageName}
                                                {item.verified && <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-sm">{item.city || '—'}</td>
                                        <td className="px-6 py-4 text-center text-slate-900 text-sm font-semibold">{item.totalServices}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-amber-600 font-bold text-sm">
                                                ₹{(item.totalRevenue || 0).toLocaleString('en-IN')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminRevenue;
