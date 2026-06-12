import { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Building2, Search, ChevronLeft, ChevronRight, ShieldCheck, ShieldX,
    Ban, CheckCircle2, XCircle, MapPin, Phone, IndianRupee, Wrench
} from 'lucide-react';

const AdminGarages = () => {
    const [garages, setGarages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [actionLoading, setActionLoading] = useState(null);

    const token = localStorage.getItem('token');

    const fetchGarages = async (p = 1, q = '') => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:5000/api/admin/garages', {
                headers: { Authorization: `Bearer ${token}` },
                params: { page: p, limit: 20, search: q }
            });
            setGarages(res.data.items || []);
            setTotal(res.data.total || 0);
            setTotalPages(res.data.totalPages || 1);
            setPage(res.data.page || 1);
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to load garages');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGarages(1, search);
    }, [search]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
    };

    const handleAction = async (garageId, action) => {
        setActionLoading(`${garageId}-${action}`);
        try {
            await axios.patch(
                `http://localhost:5000/api/admin/garages/${garageId}/${action}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchGarages(page, search);
        } catch (err) {
            alert(err.response?.data?.msg || 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (garage) => {
        if (!garage.isActive) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-500 border border-red-200">
                    <XCircle className="h-3 w-3" /> Suspended
                </span>
            );
        }
        if (garage.verified) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                <ShieldX className="h-3 w-3" /> Pending
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-500/20">
                            <Building2 className="h-4.5 w-4.5 text-white" />
                        </div>
                        Garage Management
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 ml-12">{total} garages registered</p>
                </div>

                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name or city..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-64 transition-all shadow-sm"
                        />
                    </div>
                    <button type="submit" className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                        Search
                    </button>
                </form>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>
            )}

            {/* Table */}
            <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div className="p-8 space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 bg-slate-50 rounded-lg animate-pulse"></div>
                        ))}
                    </div>
                ) : garages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                            <Building2 className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-slate-900 font-bold text-lg">No garages found</h3>
                        <p className="text-slate-500 text-sm mt-1">Try adjusting your search criteria</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Garage</th>
                                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Owner</th>
                                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">City</th>
                                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Completed</th>
                                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Revenue</th>
                                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Status</th>
                                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {garages.map((garage) => (
                                    <tr key={garage.id} className="border-b border-slate-50 hover:bg-teal-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                                    {garage.photoUrl ? (
                                                        <img src={garage.photoUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Building2 className="h-5 w-5 text-slate-400" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-slate-900 text-sm font-semibold flex items-center gap-1.5">
                                                        {garage.name}
                                                        {garage.verified && <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}
                                                    </p>
                                                    {garage.phone && (
                                                        <p className="text-slate-400 text-xs flex items-center gap-1">
                                                            <Phone className="h-3 w-3" /> {garage.phone}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-slate-900 text-sm">{garage.ownerName || '—'}</p>
                                            <p className="text-slate-400 text-xs">{garage.ownerEmail || ''}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-slate-600 text-sm flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                                {garage.city || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-900 font-semibold">
                                                <Wrench className="h-3.5 w-3.5 text-emerald-500" />
                                                {garage.servicesCompleted}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center gap-1 text-sm text-amber-600 font-bold">
                                                <IndianRupee className="h-3.5 w-3.5" />
                                                {(garage.revenue || 0).toLocaleString('en-IN')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {getStatusBadge(garage)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                {garage.isActive && !garage.verified && (
                                                    <button
                                                        onClick={() => handleAction(garage.id, 'verify')}
                                                        disabled={actionLoading === `${garage.id}-verify`}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-semibold transition-colors disabled:opacity-50 border border-emerald-200"
                                                    >
                                                        <ShieldCheck className="h-3.5 w-3.5" /> Verify
                                                    </button>
                                                )}
                                                {garage.isActive && garage.verified && (
                                                    <button
                                                        onClick={() => handleAction(garage.id, 'unverify')}
                                                        disabled={actionLoading === `${garage.id}-unverify`}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 text-xs font-semibold transition-colors disabled:opacity-50 border border-amber-200"
                                                    >
                                                        <ShieldX className="h-3.5 w-3.5" /> Unverify
                                                    </button>
                                                )}
                                                {garage.isActive ? (
                                                    <button
                                                        onClick={() => handleAction(garage.id, 'suspend')}
                                                        disabled={actionLoading === `${garage.id}-suspend`}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-xs font-semibold transition-colors disabled:opacity-50 border border-red-200"
                                                    >
                                                        <Ban className="h-3.5 w-3.5" /> Suspend
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleAction(garage.id, 'activate')}
                                                        disabled={actionLoading === `${garage.id}-activate`}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 text-xs font-semibold transition-colors disabled:opacity-50 border border-sky-200"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" /> Activate
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-slate-400 text-sm">Page {page} of {totalPages} · {total} garages</p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => fetchGarages(page - 1, search)} disabled={page <= 1}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm">
                            <ChevronLeft className="h-4 w-4" /> Previous
                        </button>
                        <button onClick={() => fetchGarages(page + 1, search)} disabled={page >= totalPages}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm">
                            Next <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminGarages;
