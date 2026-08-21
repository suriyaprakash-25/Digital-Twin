import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Receipt,
  IndianRupee,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Wallet,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import SettlementDetailsModal from '../components/settlement/SettlementDetailsModal';
import { API_BASE_URL, getAuthHeaders } from '../utils/api';

const GarageSettlements = () => {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSettlement, setSelectedSettlement] = useState(null);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/garage/settlements`, {
        headers: getAuthHeaders(),
        params: { page, limit: 15, status: statusFilter }
      });

      if (res.data?.success) {
        setSettlements(res.data.settlements || []);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching settlements:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/garage-dashboard"
            className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-teal-600 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Garage Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Settlement & Payout History
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
            Audit history of your requested and completed bank withdrawals
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <Link
            to="/garage/earnings"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors shadow-2xs"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Earnings Ledger</span>
          </Link>

          <button
            onClick={fetchSettlements}
            className="p-2 rounded-xl text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh Settlements"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs flex items-center gap-2 overflow-x-auto">
        {['ALL', 'REQUESTED', 'APPROVED', 'COMPLETED', 'CANCELLED'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === status
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
            }`}
          >
            {status === 'ALL' ? 'All Settlements' : status}
          </button>
        ))}
      </div>

      {/* Settlements Table */}
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
              When you submit withdrawal requests from your available balance in the Earnings Ledger, they will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 pl-6">Settlement ID</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Destination Account</th>
                  <th className="py-3.5 px-4">Requested At</th>
                  <th className="py-3.5 px-4">Completed At</th>
                  <th className="py-3.5 px-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {settlements.map((s) => {
                  const isCompleted = s.status === 'COMPLETED';
                  const isApproved = s.status === 'APPROVED';
                  const isCancelled = s.status === 'CANCELLED' || s.status === 'FAILED';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 pl-6 font-mono font-bold text-slate-900">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded border border-slate-200">
                          {s.settlementId}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-black text-slate-900 text-sm">
                        ₹{Number(s.approvedAmount || s.requestedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> COMPLETED
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                            <CheckCircle2 className="h-3 w-3" /> APPROVED
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                            <AlertCircle className="h-3 w-3" /> {s.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="h-3 w-3" /> {s.status || 'REQUESTED'}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-600 font-medium">
                        {s.destinationAccountId || 'Registered Account'}
                      </td>
                      <td className="py-4 px-4 text-slate-400 text-[11px]">
                        {s.requestedAt ? new Date(s.requestedAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-4 px-4 text-slate-400 text-[11px]">
                        {s.completedAt ? new Date(s.completedAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-4 px-4 pr-6 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedSettlement(s)}
                          className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all inline-flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>Details</span>
                        </button>
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
    </div>
  );
};

export default GarageSettlements;
