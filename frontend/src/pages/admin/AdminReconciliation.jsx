import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Scale,
  IndianRupee,
  Calendar,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  Play,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import ReconciliationDetailsModal from '../../components/reconciliation/ReconciliationDetailsModal';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';

const AdminReconciliation = () => {
  const [reconciliations, setReconciliations] = useState([]);
  const [summary, setSummary] = useState({
    totalChecked: 0,
    matched: 0,
    mismatched: 0,
    missing: 0,
    pending: 0,
    resolved: 0,
    totalMismatchAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [runningBatch, setRunningBatch] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchReconciliations = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/admin/reconciliation`, {
          headers: getAuthHeaders(),
          params: { page, limit: 20, status: statusFilter, search }
        }),
        axios.get(`${API_BASE_URL}/api/admin/reconciliation/summary`, {
          headers: getAuthHeaders()
        })
      ]);

      if (listRes.data?.success) {
        setReconciliations(listRes.data.reconciliations || []);
        setTotalPages(listRes.data.totalPages || 1);
      }

      if (summaryRes.data?.success) {
        setSummary(summaryRes.data.summary);
      }
    } catch (err) {
      console.error('Error fetching reconciliations:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchReconciliations();
  }, [fetchReconciliations]);

  const handleRunBatch = async () => {
    setRunningBatch(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/reconciliation/run`,
        { hours: 48, limit: 50 },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        alert(res.data.message || 'Reconciliation batch completed');
        fetchReconciliations();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error triggering batch reconciliation');
    } finally {
      setRunningBatch(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-teal-50 text-teal-700 rounded-lg border border-teal-200">
              <Scale className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">
              Financial Integrity & Audits
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Payment Reconciliation Engine
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">
            Automated multi-way cross verification between Razorpay gateway, DrivePortz invoices, and ledger records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunBatch}
            disabled={runningBatch}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Play className={`h-3.5 w-3.5 ${runningBatch ? 'animate-spin' : ''}`} />
            <span>{runningBatch ? 'Reconciling...' : 'Run 48h Reconciliation'}</span>
          </button>
          <button
            onClick={fetchReconciliations}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Checked</span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{summary.totalChecked}</div>
          <p className="text-[10px] font-medium text-slate-400 mt-0.5">Transactions audited</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">Matched</span>
          <div className="text-2xl font-black text-emerald-700 tracking-tight flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            {summary.matched}
          </div>
          <p className="text-[10px] font-medium text-emerald-600 mt-0.5">100% consistent</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 block mb-1">Mismatches</span>
          <div className="text-2xl font-black text-red-700 tracking-tight flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-red-500" />
            {summary.mismatched}
          </div>
          <p className="text-[10px] font-medium text-red-600 mt-0.5">Requires audit review</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block mb-1">Missing</span>
          <div className="text-2xl font-black text-amber-700 tracking-tight flex items-center gap-1">
            <Clock className="h-4 w-4 text-amber-500" />
            {summary.missing}
          </div>
          <p className="text-[10px] font-medium text-amber-600 mt-0.5">Not found on gateway</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block mb-1">Resolved</span>
          <div className="text-2xl font-black text-purple-700 tracking-tight flex items-center gap-1">
            <Check className="h-4 w-4 text-purple-500" />
            {summary.resolved}
          </div>
          <p className="text-[10px] font-medium text-purple-600 mt-0.5">Audited & closed</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Mismatch Amount</span>
          <div className="text-xl font-black text-slate-900 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-400 mr-0.5" />
            {Number(summary.totalMismatchAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-400 mt-0.5">Variance volume</p>
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
            placeholder="Search invoice number, payment ID, garage..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'MATCHED', 'MISMATCH', 'MISSING', 'RESOLVED'].map((status) => (
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
              {status === 'ALL' ? 'All Records' : status}
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
        ) : reconciliations.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Scale className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Reconciliation Records Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Run a reconciliation batch above to cross-verify recent gateway payments against DrivePortz records.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 pl-6">Status</th>
                  <th className="py-3.5 px-4">Invoice / Payment</th>
                  <th className="py-3.5 px-4">Garage / Vehicle</th>
                  <th className="py-3.5 px-4">Expected</th>
                  <th className="py-3.5 px-4">Razorpay</th>
                  <th className="py-3.5 px-4">Variance</th>
                  <th className="py-3.5 px-4">Audited At</th>
                  <th className="py-3.5 px-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {reconciliations.map((r) => {
                  const isMatched = r.reconciliationStatus === 'MATCHED';
                  const isMismatch = r.reconciliationStatus === 'MISMATCH';
                  const isMissing = r.reconciliationStatus === 'MISSING';
                  const isResolved = r.reconciliationStatus === 'RESOLVED';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 pl-6">
                        {isMatched ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> MATCHED
                          </span>
                        ) : isMismatch ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                            <AlertCircle className="h-3 w-3" /> MISMATCH
                          </span>
                        ) : isMissing ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="h-3 w-3" /> MISSING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">
                            <Check className="h-3 w-3" /> RESOLVED
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-900 block">{r.invoiceNumber}</span>
                        <span className="font-mono text-[10px] text-slate-400 block truncate max-w-[120px]">
                          {r.razorpayPaymentId || r.paymentId}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-800 block truncate max-w-[140px]">{r.garageName}</span>
                        <span className="text-[11px] text-slate-400 block">{r.vehicleNumber}</span>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        ₹{Number(r.expectedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        ₹{Number(r.razorpayAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 font-bold">
                        {r.amountDifference > 0 ? (
                          <span className="text-red-600">₹{r.amountDifference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-emerald-600">₹0.00</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-400 text-[11px]">
                        {r.checkedAt ? new Date(r.checkedAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-4 px-4 pr-6 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(r)}
                          className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect
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

      {/* Details & Resolution Modal */}
      {selectedRecord && (
        <ReconciliationDetailsModal
          isOpen={Boolean(selectedRecord)}
          onClose={() => setSelectedRecord(null)}
          reconciliation={selectedRecord}
          onResolved={() => {
            fetchReconciliations();
            setSelectedRecord(null);
          }}
        />
      )}
    </div>
  );
};

export default AdminReconciliation;
