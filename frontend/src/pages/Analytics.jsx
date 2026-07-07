import { useEffect, useState } from 'react';
import axios from 'axios';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Activity, TrendingUp, DollarSign, Wrench, PieChart as PieChartIcon, CalendarCheck, CheckCircle, Clock } from 'lucide-react';

const COLORS = ['#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Analytics = () => {
    const [data, setData] = useState(null);
    const [garageData, setGarageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState('USER');

    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    const [yAxisWidth, setYAxisWidth] = useState(window.innerWidth < 640 ? 80 : 150);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 640;
            setIsMobile(mobile);
            setYAxisWidth(mobile ? 80 : 150);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem('user');
        let role = 'USER';
        try {
            role = stored ? (JSON.parse(stored).role || 'USER') : 'USER';
        } catch { /* ignore */ }
        setUserRole(role);

        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const fetches = role === 'GARAGE'
            ? [axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/analytics/garage`, { headers })]
            : [axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/analytics`, { headers })];

        Promise.all(fetches)
            .then(([res]) => {
                if (role === 'GARAGE') setGarageData(res.data);
                else setData(res.data);
            })
            .catch((err) => console.error('Error fetching analytics:', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-teal-600"></div>
            </div>
        );
    }

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 3 }).format(val);

    // ── GARAGE ANALYTICS ────────────────────────────────────────────────────────
    if (userRole === 'GARAGE') {
        if (!garageData) {
            return (
                <div className="text-center py-12 px-4">
                    <Activity className="h-10 w-10 md:h-16 md:w-16 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base md:text-xl font-bold text-slate-900 mb-1">Analytics Unavailable</h3>
                    <p className="text-2xs md:text-sm text-slate-550 font-medium max-w-sm mx-auto">Complete your garage profile and start accepting bookings to see analytics.</p>
                </div>
            );
        }

        const { bookingsByMonth, revenueByMonth, statusDistribution, topServices, totalBookings, pendingCount, completedCount, totalRevenue, totalServices } = garageData;

        // Dynamic height for horizontal bar chart
        const topServicesChartHeight = isMobile
            ? Math.min(220, Math.max(120, topServices.length * 50))
            : 320;

        return (
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-in fade-in duration-500 pb-12 lg:pb-8">
                <header className="mb-3 sm:mb-8 p-3.5 md:p-8 bg-slate-900 rounded-xl md:rounded-3xl text-white shadow-xl relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-emerald-600/30 to-transparent"></div>
                    <div className="relative z-10 flex flex-col lg:flex-row justify-between lg:items-center gap-3">
                        <div>
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 md:px-3 md:py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-3xs md:text-xs font-bold tracking-wide border border-emerald-500/30 mb-1.5">
                                <TrendingUp className="h-3 w-3" /> Garage Performance Analytics
                            </div>
                            <h1 className="text-base md:text-4xl font-extrabold tracking-tight">Business Insights</h1>
                            <p className="text-slate-400 mt-0.5 md:mt-2 font-medium text-2xs md:text-lg max-w-2xl">
                                Track bookings, revenue trends, and service performance across your garage operations.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 md:gap-4">
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-1.5 md:p-4 rounded-lg md:rounded-2xl text-center min-w-[70px] md:min-w-[110px]">
                                <p className="text-teal-300 text-3xs md:text-xs font-bold uppercase tracking-wider mb-0.5">Bookings</p>
                                <p className="text-xs md:text-2xl font-black">{totalBookings}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-1.5 md:p-4 rounded-lg md:rounded-2xl text-center min-w-[70px] md:min-w-[110px]">
                                <p className="text-emerald-300 text-3xs md:text-xs font-bold uppercase tracking-wider mb-0.5">Completed</p>
                                <p className="text-xs md:text-2xl font-black">{completedCount}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-1.5 md:p-4 rounded-lg md:rounded-2xl text-center min-w-[70px] md:min-w-[110px]">
                                <p className="text-amber-300 text-3xs md:text-xs font-bold uppercase tracking-wider mb-0.5">Revenue</p>
                                <p className="text-xs md:text-2xl font-black">₹{(totalRevenue / 1000).toFixed(1)}k</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-1.5 md:p-4 rounded-lg md:rounded-2xl text-center min-w-[70px] md:min-w-[110px]">
                                <p className="text-purple-300 text-3xs md:text-xs font-bold uppercase tracking-wider mb-0.5">Services</p>
                                <p className="text-xs md:text-2xl font-black">{totalServices}</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-6 mb-3 sm:mb-8">
                    <div className="bg-teal-50 border border-teal-100 rounded-xl md:rounded-2xl p-2.5 md:p-5 flex items-center gap-2.5 md:gap-4">
                        <div className="bg-teal-100 p-1.5 md:p-3 rounded-lg md:rounded-xl text-teal-600"><CalendarCheck className="h-4 w-4 md:h-6 md:w-6" /></div>
                        <div>
                            <p className="text-3xs md:text-sm text-teal-650 font-bold">Total Bookings</p>
                            <p className="text-sm md:text-3xl font-black text-teal-800">{totalBookings}</p>
                        </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl md:rounded-2xl p-2.5 md:p-5 flex items-center gap-2.5 md:gap-4">
                        <div className="bg-emerald-100 p-1.5 md:p-3 rounded-lg md:rounded-xl text-emerald-600"><CheckCircle className="h-4 w-4 md:h-6 md:w-6" /></div>
                        <div>
                            <p className="text-3xs md:text-sm text-emerald-650 font-bold">Completed</p>
                            <p className="text-sm md:text-3xl font-black text-emerald-800">{completedCount}</p>
                        </div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl md:rounded-2xl p-2.5 md:p-5 flex items-center gap-2.5 md:gap-4">
                        <div className="bg-amber-100 p-1.5 md:p-3 rounded-lg md:rounded-xl text-amber-600"><Clock className="h-4 w-4 md:h-6 md:w-6" /></div>
                        <div>
                            <p className="text-3xs md:text-sm text-amber-650 font-bold">Pending Requests</p>
                            <p className="text-sm md:text-3xl font-black text-amber-800">{pendingCount}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8 mb-3 sm:mb-8">
                    {/* Monthly Bookings BarChart */}
                    <div className="bg-white border border-slate-200 rounded-xl md:rounded-3xl p-3 md:p-6 shadow-sm">
                        <h3 className="text-xs md:text-xl font-bold flex items-center gap-2 mb-3 md:mb-6 text-slate-900 border-b border-slate-100 pb-2 md:pb-4">
                            <CalendarCheck className="h-4 w-4 md:h-5 md:w-5 text-teal-500" />
                            Monthly Bookings
                        </h3>
                        {bookingsByMonth.length === 0 ? (
                            <p className="text-slate-500 italic text-center py-6 text-2xs md:text-sm">No booking data available yet.</p>
                        ) : (
                            <div className="h-48 sm:h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={bookingsByMonth} margin={isMobile ? { top: 10, right: 5, left: -25, bottom: 0 } : { top: 5, right: 20, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} dy={isMobile ? 5 : 10} />
                                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} />
                                        <RechartsTooltip
                                            formatter={(value) => [value, 'Bookings']}
                                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: isMobile ? '11px' : '13px' }}
                                        />
                                        <Bar dataKey="count" fill="#14b8a6" radius={[6, 6, 0, 0]} barSize={isMobile ? 18 : 32} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Revenue Over Time LineChart */}
                    <div className="bg-white border border-slate-200 rounded-xl md:rounded-3xl p-3 md:p-6 shadow-sm">
                        <h3 className="text-xs md:text-xl font-bold flex items-center gap-2 mb-3 md:mb-6 text-slate-900 border-b border-slate-100 pb-2 md:pb-4">
                            <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-emerald-500" />
                            Revenue Over Time
                        </h3>
                        {revenueByMonth.length === 0 ? (
                            <p className="text-slate-500 italic text-center py-6 text-2xs md:text-sm">No revenue data available yet.</p>
                        ) : (
                            <div className="h-48 sm:h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={revenueByMonth} margin={isMobile ? { top: 10, right: 5, left: -20, bottom: 0 } : { top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} dy={isMobile ? 5 : 10} />
                                        <YAxis tickFormatter={(v) => `₹${v / 1000}k`} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} />
                                        <RechartsTooltip
                                            formatter={(value) => [formatCurrency(value), 'Revenue']}
                                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: isMobile ? '11px' : '13px' }}
                                        />
                                        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={isMobile ? 2 : 4} dot={{ r: isMobile ? 3 : 5, fill: '#10b981' }} activeDot={{ r: 8 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8 mb-3 sm:mb-8">
                    {/* Booking Status Pie */}
                    <div className="bg-white border border-slate-200 rounded-xl md:rounded-3xl p-3 md:p-6 shadow-sm flex flex-col">
                        <h3 className="text-xs md:text-xl font-bold flex items-center gap-2 mb-3 md:mb-6 text-slate-900 border-b border-slate-100 pb-2 md:pb-4">
                            <PieChartIcon className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
                            Booking Status Distribution
                        </h3>
                        {statusDistribution.length === 0 ? (
                            <p className="text-slate-500 italic text-center py-6 text-2xs md:text-sm">No status data available.</p>
                        ) : (
                            <div className="w-full h-[200px] sm:h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={statusDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={isMobile ? 40 : 80}
                                            outerRadius={isMobile ? 65 : 120}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {statusDistribution.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            formatter={(value, name) => [`${value} Bookings`, name]}
                                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: isMobile ? '11px' : '13px' }}
                                        />
                                        <Legend iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Top Services horizontal BarChart */}
                    <div className="bg-white border border-slate-200 rounded-xl md:rounded-3xl p-3 md:p-6 shadow-sm">
                        <h3 className="text-xs md:text-xl font-bold flex items-center gap-2 mb-3 md:mb-6 text-slate-900 border-b border-slate-100 pb-2 md:pb-4">
                            <Wrench className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />
                            Top Services by Bookings
                        </h3>
                        {topServices.length === 0 ? (
                            <p className="text-slate-500 italic text-center py-6 text-2xs md:text-sm">No service booking data available.</p>
                        ) : (
                            <div style={{ height: topServicesChartHeight }} className="w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topServices} layout="vertical" margin={isMobile ? { top: 5, right: 10, left: -20, bottom: 5 } : { top: 5, right: 20, left: 10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f1f5f9" />
                                        <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: isMobile ? 9 : 11, fontWeight: 'bold' }} width={yAxisWidth} />
                                        <RechartsTooltip
                                            formatter={(value) => [value, 'Bookings']}
                                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: isMobile ? '11px' : '13px' }}
                                        />
                                        <Bar dataKey="bookings" radius={[0, 8, 8, 0]} barSize={isMobile ? 16 : 28}>
                                            {topServices.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── USER / FLEET ANALYTICS ───────────────────────────────────────────────────
    if (!data) {
        return (
            <div className="text-center py-12 px-4">
                <Activity className="h-10 w-10 md:h-16 md:w-16 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base md:text-xl font-bold text-slate-900 mb-1">Analytics Unavailable</h3>
                <p className="text-2xs md:text-sm text-slate-550 font-medium max-w-sm mx-auto">Add vehicles and service records to generate insights.</p>
            </div>
        );
    }

    const { expenseTrend, categoryDistribution, totalFleetKm, usageDistribution, totalServices } = data;

    // Dynamic height for vertical/horizontal bar chart representing mileage
    const usageChartHeight = isMobile
        ? Math.min(220, Math.max(120, usageDistribution.length * 60))
        : 320;

    return (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 animate-in fade-in duration-500 pb-12 lg:pb-8">
            <header className="mb-3 sm:mb-8 p-3.5 md:p-8 bg-slate-900 rounded-xl md:rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-teal-600/30 to-transparent"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-3">
                    <div>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 md:px-3 md:py-1 bg-teal-500/20 text-teal-300 rounded-full text-3xs md:text-xs font-bold tracking-wide border border-teal-500/30 mb-1.5">
                            <TrendingUp className="h-3 w-3" /> Advanced Twin Analytics
                        </div>
                        <h1 className="text-base md:text-4xl font-extrabold tracking-tight">Fleet Intelligence</h1>
                        <p className="text-slate-400 mt-0.5 md:mt-2 font-medium text-2xs md:text-lg max-w-2xl">
                            Visualizing expenses, maintenance history, and lifecycle trends across your registered vehicles.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 md:gap-4">
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-1.5 md:p-4 rounded-lg md:rounded-2xl text-center min-w-[70px] md:min-w-[120px]">
                            <p className="text-teal-300 text-3xs md:text-xs font-bold uppercase tracking-wider mb-0.5">Fleet Km</p>
                            <p className="text-xs md:text-2xl font-black">{(totalFleetKm || 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-1.5 md:p-4 rounded-lg md:rounded-2xl text-center min-w-[70px] md:min-w-[120px]">
                            <p className="text-emerald-300 text-3xs md:text-xs font-bold uppercase tracking-wider mb-0.5">Services</p>
                            <p className="text-xs md:text-2xl font-black">{totalServices || 0}</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8 mb-3 sm:mb-8">
                {/* Expense Trend Line Chart */}
                <div className="bg-white border border-slate-200 rounded-xl md:rounded-3xl p-3 md:p-6 shadow-sm">
                    <h3 className="text-xs md:text-xl font-bold flex items-center gap-2 mb-3 md:mb-6 text-slate-900 border-b border-slate-100 pb-2 md:pb-4">
                        <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-teal-500" />
                        Monthly Total Expenses
                    </h3>
                    {expenseTrend.length === 0 ? (
                        <p className="text-slate-500 italic text-center py-6 text-2xs md:text-sm">No expense data available.</p>
                    ) : (
                        <div className="h-48 sm:h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={expenseTrend} margin={isMobile ? { top: 10, right: 5, left: -20, bottom: 0 } : { top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} dy={isMobile ? 5 : 10} />
                                    <YAxis tickFormatter={(val) => `₹${val / 1000}k`} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} />
                                    <RechartsTooltip
                                        formatter={(value) => [formatCurrency(value), "Cost"]}
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: isMobile ? '11px' : '13px' }}
                                    />
                                    <Line type="monotone" dataKey="cost" stroke="#14b8a6" strokeWidth={isMobile ? 2 : 4} activeDot={{ r: 8 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Maintenance Category Pie Chart */}
                <div className="bg-white border border-slate-200 rounded-xl md:rounded-3xl p-3 md:p-6 shadow-sm flex flex-col">
                    <h3 className="text-xs md:text-xl font-bold flex items-center gap-2 mb-3 md:mb-6 text-slate-900 border-b border-slate-100 pb-2 md:pb-4">
                        <PieChartIcon className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
                        Service Category Breakdown
                    </h3>
                    {categoryDistribution.length === 0 ? (
                        <p className="text-slate-500 italic text-center py-6 text-2xs md:text-sm">No category data available.</p>
                    ) : (
                        <div className="w-full h-[200px] sm:h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={isMobile ? 40 : 80}
                                        outerRadius={isMobile ? 65 : 120}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(value) => [`${value} Records`, "Frequency"]}
                                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: isMobile ? '11px' : '13px' }}
                                    />
                                    <Legend iconType="circle" verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Usage Distribution */}
            <div className="bg-white border border-slate-200 rounded-xl md:rounded-3xl p-3 md:p-6 shadow-sm mb-3 md:mb-8">
                <h3 className="text-xs md:text-xl font-bold flex items-center gap-2 mb-3 md:mb-6 text-slate-900 border-b border-slate-100 pb-2 md:pb-4">
                    <Activity className="h-4 w-4 md:h-5 md:w-5 text-emerald-500" />
                    Fleet Mileage Distribution
                </h3>
                {usageDistribution.length === 0 ? (
                    <p className="text-slate-500 italic text-center py-6 text-2xs md:text-sm">No mileage data available.</p>
                ) : (
                    <div style={{ height: usageChartHeight }} className="w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={usageDistribution} margin={isMobile ? { top: 10, right: 10, left: -20, bottom: 5 } : { top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12 }} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: isMobile ? 10 : 12, fontWeight: 'bold' }} width={yAxisWidth} />
                                <RechartsTooltip
                                    formatter={(value) => [`${value.toLocaleString()} km`, "Mileage"]}
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: isMobile ? '11px' : '13px' }}
                                />
                                <Bar dataKey="km" fill="#10b981" radius={[0, 8, 8, 0]} barSize={isMobile ? 16 : 30}>
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
