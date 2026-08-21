import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Percent,
  IndianRupee,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Building,
  Car,
  Eye,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import CommissionDetailsModal from '../../components/commission/CommissionDetailsModal';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';

const AdminCommissions = () => {
  const [commissions, setCommissions] = useState([]);
  const [summary, setSummary] = useState({
    totalGrossVolume: 0,
    totalPlatformCommission: 0,
    todayPlatformCommission: 0,
    monthPlatformCommission: 0,
    totalGarageEarnings: 0,
    netPlatformRevenue: 0,
    totalEarningRecords: 0
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCommission, setSelectedCommission] = useState(null);

  const fetchCommissions = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, allRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/admin/commissions/summary`, {
          headers: getAuthHeaders()
        }),
        axios.get(`${API_BASE_URL}/api/admin/commissions/all`, {
          headers: getAuthHeaders(),
          params: { page, limit: 20, status: statusFilter, search }
        })
      ]);

      if (sumRes.status === 'fulfilled' && sumRes.value.data?.success) {
        setSummary(sumRes.value.data.summary);
      }

      if (allRes.status === 'fulfilled' && allRes.value.data?.success) {
        setCommissions(allRes.value.data.commissions || []);
        setTotalPages(allRes.value.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching admin commissions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-teal-50 text-teal-700 rounded-lg border border-teal-200">
              <Percent className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">
              Financial Administration
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Platform Commissions & Revenue
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">
            Monitor gross marketplace volume, commission deductions, and net earnings across all garages
          </p>
        </div>

        <button
          onClick={fetchCommissions}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Gross Volume</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-400 mr-0.5" />
            {Number(summary.totalGrossVolume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Total bill volume</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block mb-1">Platform Revenue</span>
          <div className="text-xl sm:text-2xl font-black text-teal-700 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-teal-500 mr-0.5" />
            {Number(summary.totalPlatformCommission || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-teal-600 mt-1">Cumulative fee</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">Today's Fee</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-emerald-500 mr-0.5" />
            {Number(summary.todayPlatformCommission || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Earned today</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">This Month</span>
          <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-400 mr-0.5" />
            {Number(summary.monthPlatformCommission || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Current month fee</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">Garage Payouts</span>
          <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-400 mr-0.5" />
            {Number(summary.totalGarageEarnings || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Net garage share</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Logs</span>
          <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
            {summary.totalEarningRecords}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-1">Settled transactions</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number, garage, vehicle, payment ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'AVAILABLE', 'SETTLED', 'SETTLEMENT_PENDING', 'REFUND_ADJUSTMENT'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {status === 'ALL' ? 'All Records' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Global Commission Table */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : commissions.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Percent className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Commission Records Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Transactions captured by the system will appear here with automatic platform fee breakdowns.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 pl-6">Invoice #</th>
                  <th className="py-3.5 px-4">Garage</th>
                  <th className="py-3.5 px-4">Service & Vehicle</th>
                  <th className="py-3.5 px-4">Gross</th>
                  <th className="py-3.5 px-4">Platform Fee</th>
                  <th className="py-3.5 px-4">Net Garage</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-4 pl-6 font-mono font-bold text-slate-900">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        {c.invoiceNumber}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-800">
                      {c.garageName}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{c.serviceType}</div>
                      <div className="text-[11px] text-slate-400">{c.vehicleNumber}</div>
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-900">
                      ₹{(parseFloat(c.grossAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 font-black text-red-600">
                      ₹{(parseFloat(c.platformCommission) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({c.commissionRate}%)
                    </td>
                    <td className="py-4 px-4 font-black text-emerald-700">
                      ₹{(parseFloat(c.netAfterRefund || c.garageNetAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 pr-6 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedCommission(c)}
                        className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Commission Details Modal */}
      {selectedCommission && (
        <CommissionDetailsModal
          isOpen={Boolean(selectedCommission)}
          onClose={() => setSelectedCommission(null)}
          earning={selectedCommission}
        />
      )}
    </div>
  );
};

export default AdminCommissions;
