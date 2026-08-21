import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Receipt,
  IndianRupee,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Building,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Eye,
  Check,
  X,
  Play,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import SettlementDetailsModal from '../../components/settlement/SettlementDetailsModal';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';

const AdminSettlements = () => {
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({
    totalPendingVolume: 0,
    totalSettledVolume: 0,
    pendingCount: 0,
    completedCount: 0,
    totalRequests: 0
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals & Action States
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModalSettlement, setRejectModalSettlement] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/settlements`, {
        headers: getAuthHeaders(),
        params: { page, limit: 20, status: statusFilter, search }
      });

      if (res.data?.success) {
        setSettlements(res.data.settlements || []);
        if (res.data.summary) setSummary(res.data.summary);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error loading admin settlements:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const handleApprove = async (s) => {
    if (!window.confirm(`Approve settlement request ${s.settlementId} for ₹${Number(s.requestedAmount).toLocaleString('en-IN')}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/settlements/${s.id}/approve`,
        {},
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        fetchSettlements();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error approving settlement');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectModalSettlement) return;

    setActionLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/settlements/${rejectModalSettlement.id}/reject`,
        { reason: rejectReason },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        setRejectModalSettlement(null);
        setRejectReason('');
        fetchSettlements();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error rejecting settlement');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessPayout = async (s) => {
    if (!window.confirm(`Execute payout for ${s.settlementId} (₹${Number(s.approvedAmount || s.requestedAmount).toLocaleString('en-IN')}) via Settlement Provider?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/settlements/${s.id}/process`,
        {},
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        alert(res.data.message || 'Settlement completed successfully!');
        fetchSettlements();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error processing payout');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-teal-50 text-teal-700 rounded-lg border border-teal-200">
              <Receipt className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">
              Payout Operations
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Garage Settlements & Payouts
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">
            Review, approve, and execute bank settlement transfers for verified garage partners
          </p>
        </div>

        <button
          onClick={fetchSettlements}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block mb-1">Pending Review</span>
          <div className="text-2xl font-black text-amber-700 tracking-tight flex items-center">
            <IndianRupee className="h-5 w-5 text-amber-500 mr-0.5" />
            {Number(summary.totalPendingVolume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] font-medium text-amber-600 mt-1">{summary.pendingCount} requests awaiting review</p>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">Total Settled Volume</span>
          <div className="text-2xl font-black text-emerald-700 tracking-tight flex items-center">
            <IndianRupee className="h-5 w-5 text-emerald-500 mr-0.5" />
            {Number(summary.totalSettledVolume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] font-medium text-emerald-600 mt-1">{summary.completedCount} payouts completed</p>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">Completed Payouts</span>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            {summary.completedCount}
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1">Successfully transferred</p>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Requests</span>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            {summary.totalRequests}
          </div>
          <p className="text-[11px] font-medium text-slate-400 mt-1">All-time settlement logs</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by settlement ID, garage, account..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'REQUESTED', 'APPROVED', 'COMPLETED', 'CANCELLED'].map((status) => (
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
              {status === 'ALL' ? 'All Requests' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : settlements.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Settlement Requests Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Garage payout withdrawal requests will appear here for administrative verification and execution.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 pl-6">Settlement ID</th>
                  <th className="py-3.5 px-4">Garage</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Destination</th>
                  <th className="py-3.5 px-4">Requested At</th>
                  <th className="py-3.5 px-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {settlements.map((s) => {
                  const isCompleted = s.status === 'COMPLETED';
                  const isApproved = s.status === 'APPROVED';
                  const isRequested = s.status === 'REQUESTED' || s.status === 'UNDER_REVIEW';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 pl-6 font-mono font-bold text-slate-900">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {s.settlementId}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-800">
                        {s.garageName}
                      </td>
                      <td className="py-4 px-4 font-black text-slate-900 text-sm">
                        ₹{Number(s.approvedAmount || s.requestedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> COMPLETED
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                            APPROVED
                          </span>
                        ) : isRequested ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="h-3 w-3" /> REQUESTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                            {s.status}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-600">
                        {s.destinationAccountId}
                      </td>
                      <td className="py-4 px-4 text-slate-400 text-[11px]">
                        {s.requestedAt ? new Date(s.requestedAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-4 px-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSettlement(s)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Inspect Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {isRequested && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleApprove(s)}
                                className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-all"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => setRejectModalSettlement(s)}
                                className="px-2.5 py-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleProcessPayout(s)}
                              className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all flex items-center gap-1 shadow-2xs"
                            >
                              <Play className="h-3 w-3" />
                              Execute Payout
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Details Modal */}
      {selectedSettlement && (
        <SettlementDetailsModal
          isOpen={Boolean(selectedSettlement)}
          onClose={() => setSelectedSettlement(null)}
          settlement={selectedSettlement}
        />
      )}

      {/* Reject Modal Dialog */}
      {rejectModalSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-black text-slate-900">
              Reject Settlement Request
            </h3>
            <p className="text-xs text-slate-500">
              Rejecting {rejectModalSettlement.settlementId} will unlock ₹{Number(rejectModalSettlement.requestedAmount).toLocaleString('en-IN')} back to the garage's available balance.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-3">
              <textarea
                required
                rows="3"
                placeholder="Specify rejection reason (e.g. Bank details unverified)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalSettlement(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettlements;
