import { useEffect, useState } from 'react';
import axios from 'axios';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Activity, TrendingUp, DollarSign, Wrench, PieChart as PieChartIcon } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Analytics = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('http://localhost:5000/api/analytics', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data);
            } catch (err) {
                console.error('Error fetching analytics:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-24">
                <Activity className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Analytics Unavailable</h3>
                <p className="text-slate-500 font-medium">Add vehicles and service records to generate insights.</p>
            </div>
        );
    }

    const { expenseTrend, categoryDistribution, totalFleetKm, usageDistribution, totalVehicles, totalServices } = data;

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 3 }).format(val);

    return (
        <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            <header className="mb-8 p-8 bg-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-blue-600/30 to-transparent"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold tracking-wide border border-blue-500/30 mb-3">
                            <TrendingUp className="h-4 w-4" /> Advanced Twin Analytics
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight">Fleet Intelligence</h1>
                        <p className="text-slate-400 mt-2 font-medium text-lg max-w-2xl">
                            Visualizing expenses, maintenance history, and lifecycle trends across your registered vehicles.
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl text-center min-w-[120px]">
                            <p className="text-blue-300 text-xs font-bold uppercase tracking-wider mb-1">Fleet Km</p>
                            <p className="text-2xl font-black">{totalFleetKm.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl text-center min-w-[120px]">
                            <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">Services</p>
                            <p className="text-2xl font-black">{totalServices}</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Expense Trend Line Chart */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-900 border-b border-slate-100 pb-4">
                        <DollarSign className="h-5 w-5 text-blue-500" />
                        Monthly Total Expenses
                    </h3>
                    {expenseTrend.length === 0 ? (
                        <p className="text-slate-500 italic text-center py-12">No expense data available.</p>
                    ) : (
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={expenseTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                    <YAxis tickFormatter={(val) => `₹${val / 1000}k`} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <RechartsTooltip
                                        formatter={(value) => [formatCurrency(value), "Cost"]}
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={4} activeDot={{ r: 8 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Maintenance Category Pie Chart */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
                    <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-900 border-b border-slate-100 pb-4">
                        <PieChartIcon className="h-5 w-5 text-amber-500" />
                        Service Category Breakdown
                    </h3>
                    {categoryDistribution.length === 0 ? (
                        <p className="text-slate-500 italic text-center py-12">No category data available.</p>
                    ) : (
                        <div className="flex-1 w-full flex items-center justify-center min-h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={120}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(value) => [`${value} Records`, "Frequency"]}
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Usage Distribution */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm mb-8">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-900 border-b border-slate-100 pb-4">
                    <Activity className="h-5 w-5 text-emerald-500" />
                    Fleet Mileage Distribution
                </h3>
                {usageDistribution.length === 0 ? (
                    <p className="text-slate-500 italic text-center py-12">No mileage data available.</p>
                ) : (
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={usageDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} width={150} />
                                <RechartsTooltip
                                    formatter={(value) => [`${value.toLocaleString()} km`, "Mileage"]}
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="km" fill="#10b981" radius={[0, 8, 8, 0]} barSize={30}>
                                    {usageDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

        </div>
    );
};

export default Analytics;
