import { useEffect, useState } from 'react';
import axios from 'axios';
import { Users, Search, ChevronLeft, ChevronRight, Eye, Car, Wrench, UserCircle2 } from 'lucide-react';

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [expandedUser, setExpandedUser] = useState(null);
    const [userDetail, setUserDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const token = localStorage.getItem('token');

    const fetchUsers = async (p = 1, q = '') => {
        setLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { page: p, limit: 20, search: q }
            });
            setUsers(res.data.items || []);
            setTotal(res.data.total || 0);
            setTotalPages(res.data.totalPages || 1);
            setPage(res.data.page || 1);
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers(1, search);
    }, [search]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearch(searchInput);
    };

    const handleExpand = async (userId) => {
        if (expandedUser === userId) {
            setExpandedUser(null);
            setUserDetail(null);
            return;
        }
        setExpandedUser(userId);
        setDetailLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUserDetail(res.data);
        } catch {
            setUserDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const formatDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    const getRoleBadge = (role) => {
        const r = String(role).toUpperCase();
        const map = {
            USER: 'bg-sky-50 text-sky-600 border-sky-200',
            GARAGE: 'bg-amber-50 text-amber-600 border-amber-200',
            ADMIN: 'bg-teal-50 text-teal-600 border-teal-200'
        };
        return map[r] || map.USER;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-500/20 shrink-0">
                            <Users className="h-4 w-4 text-white" />
                        </div>
                        User Management
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 ml-12">{total} total users</p>
                </div>

                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 w-full sm:w-64 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm whitespace-nowrap"
                    >
                        Search
                    </button>
                </form>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>
            )}

            {/* Desktop Table */}
            <div className="hidden md:block rounded-2xl bg-white border border-slate-200 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {loading ? (
                    <div className="p-8 space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-14 bg-slate-50 rounded-lg animate-pulse"></div>
                        ))}
                    </div>
                ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                            <Users className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-slate-900 font-bold text-lg">No users found</h3>
                        <p className="text-slate-500 text-sm mt-1">Try adjusting your search criteria</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">User</th>
                                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Role</th>
                                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Vehicles</th>
                                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Services</th>
                                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Joined</th>
                                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <>
                                        <tr
                                            key={user.id}
                                            className={`border-b border-slate-50 hover:bg-teal-50/30 transition-colors cursor-pointer ${expandedUser === user.id ? 'bg-teal-50/20' : ''}`}
                                            onClick={() => handleExpand(user.id)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                                        {user.photoUrl ? (
                                                            <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <UserCircle2 className="h-5 w-5 text-slate-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-900 text-sm font-semibold">{user.name || 'Unnamed'}</p>
                                                        <p className="text-slate-400 text-xs">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${getRoleBadge(user.role)}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center gap-1.5 text-sm text-slate-900 font-semibold">
                                                    <Car className="h-3.5 w-3.5 text-sky-500" />
                                                    {user.vehicleCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center gap-1.5 text-sm text-slate-900 font-semibold">
                                                    <Wrench className="h-3.5 w-3.5 text-emerald-500" />
                                                    {user.serviceCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">
                                                {formatDate(user.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleExpand(user.id); }}
                                                    className="p-2 rounded-lg hover:bg-teal-50 text-slate-400 hover:text-teal-600 transition-colors"
                                                    title="View details"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>

                                        {expandedUser === user.id && (
                                            <tr key={`${user.id}-detail`}>
                                                <td colSpan={6} className="px-6 py-4 bg-slate-50/50">
                                                    {detailLoading ? (
                                                        <div className="h-24 flex items-center justify-center">
                                                            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                                                        </div>
                                                    ) : userDetail ? (
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            <div>
                                                                <h4 className="text-slate-900 font-bold text-sm mb-3 flex items-center gap-2">
                                                                    <Car className="h-4 w-4 text-sky-500" />
                                                                    Vehicles ({userDetail.vehicles?.length || 0})
                                                                </h4>
                                                                {userDetail.vehicles?.length > 0 ? (
                                                                    <div className="space-y-2">
                                                                        {userDetail.vehicles.map((v) => (
                                                                            <div key={v.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-slate-100">
                                                                                <div>
                                                                                    <p className="text-slate-900 text-sm font-medium">{v.brand} {v.model}</p>
                                                                                    <p className="text-slate-400 text-xs">{v.vehicleNumber} · {v.fuelType} · {v.year}</p>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-slate-400 text-sm">No vehicles registered</p>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h4 className="text-slate-900 font-bold text-sm mb-3 flex items-center gap-2">
                                                                    <Wrench className="h-4 w-4 text-emerald-500" />
                                                                    Recent Services ({userDetail.services?.length || 0})
                                                                </h4>
                                                                {userDetail.services?.length > 0 ? (
                                                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                                                        {userDetail.services.slice(0, 10).map((s) => (
                                                                            <div key={s.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-slate-100">
                                                                                <div>
                                                                                    <p className="text-slate-900 text-sm font-medium">{s.serviceType || s.serviceCategory}</p>
                                                                                    <p className="text-slate-400 text-xs">{s.garageName || 'Self-service'} · {formatDate(s.serviceDate)}</p>
                                                                                </div>
                                                                                <span className="text-amber-600 text-sm font-bold">₹{(s.totalCost || 0).toLocaleString('en-IN')}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-slate-400 text-sm">No service records</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-slate-400 text-sm">Could not load details</p>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200 animate-pulse" />
                        ))}
                    </div>
                ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-200">
                        <Users className="h-10 w-10 text-slate-300 mb-3" />
                        <h3 className="text-slate-900 font-bold">No users found</h3>
                        <p className="text-slate-500 text-sm mt-1">Try adjusting your search</p>
                    </div>
                ) : (
                    users.map((user) => (
                        <div key={user.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <button
                                className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                                onClick={() => handleExpand(user.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                        {user.photoUrl
                                            ? <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                                            : <UserCircle2 className="h-5 w-5 text-slate-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-slate-900 text-sm font-semibold truncate">{user.name || 'Unnamed'}</p>
                                            <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border shrink-0 ${getRoleBadge(user.role)}`}>
                                                {user.role}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 text-xs truncate">{user.email}</p>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                                                <Car className="h-3 w-3 text-sky-500" /> {user.vehicleCount} vehicles
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                                                <Wrench className="h-3 w-3 text-emerald-500" /> {user.serviceCount} services
                                            </span>
                                            <span className="text-xs text-slate-400">{formatDate(user.createdAt)}</span>
                                        </div>
                                    </div>
                                    <Eye className={`h-4 w-4 shrink-0 ${expandedUser === user.id ? 'text-teal-600' : 'text-slate-300'}`} />
                                </div>
                            </button>

                            {expandedUser === user.id && (
                                <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                                    {detailLoading ? (
                                        <div className="flex items-center justify-center py-6">
                                            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : userDetail ? (
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-slate-900 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                    <Car className="h-3.5 w-3.5 text-sky-500" /> Vehicles ({userDetail.vehicles?.length || 0})
                                                </h4>
                                                {userDetail.vehicles?.length > 0 ? (
                                                    <div className="space-y-1.5">
                                                        {userDetail.vehicles.map((v) => (
                                                            <div key={v.id} className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                                                                <p className="text-slate-900 text-sm font-medium">{v.brand} {v.model}</p>
                                                                <p className="text-slate-400 text-xs">{v.vehicleNumber} · {v.fuelType} · {v.year}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-slate-400 text-xs">No vehicles</p>}
                                            </div>
                                            <div>
                                                <h4 className="text-slate-900 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                    <Wrench className="h-3.5 w-3.5 text-emerald-500" /> Services ({userDetail.services?.length || 0})
                                                </h4>
                                                {userDetail.services?.length > 0 ? (
                                                    <div className="space-y-1.5">
                                                        {userDetail.services.slice(0, 5).map((s) => (
                                                            <div key={s.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                                                                <div>
                                                                    <p className="text-slate-900 text-xs font-medium">{s.serviceType || s.serviceCategory}</p>
                                                                    <p className="text-slate-400 text-xs">{formatDate(s.serviceDate)}</p>
                                                                </div>
                                                                <span className="text-amber-600 text-xs font-bold">₹{(s.totalCost || 0).toLocaleString('en-IN')}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-slate-400 text-xs">No service records</p>}
                                            </div>
                                        </div>
                                    ) : <p className="text-slate-400 text-sm">Could not load details</p>}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-slate-400 text-sm">
                        Page {page} of {totalPages} · {total} users
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchUsers(page - 1, search)}
                            disabled={page <= 1}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <ChevronLeft className="h-4 w-4" /> Previous
                        </button>
                        <button
                            onClick={() => fetchUsers(page + 1, search)}
                            disabled={page >= totalPages}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            Next <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsers;
