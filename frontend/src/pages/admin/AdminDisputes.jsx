import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  IndianRupee,
  Calendar,
  Search,
  RefreshCw,
  Building,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  Check,
  X,
  User,
  Paperclip
} from 'lucide-react';
import ErrorState from '../../components/common/ErrorState';
import DisputeResolutionModal from '../../components/admin/DisputeResolutionModal';
import { useFinancialAction } from '../../components/admin/useFinancialAction';
import { useToast } from '../../context/toastContextCore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { apiGet, apiGetPage, apiPost, getErrorMessage } from '../../utils/api';

const AdminDisputes = () => {
  const { showSuccess } = useToast();
  const [disputes, setDisputes] = useState([]);
  const [summary, setSummary] = useState({
    totalDisputes: 0,
    open: 0,
    underReview: 0,
    resolved: 0,
    rejected: 0,
    refundDisputes: 0,
    totalDisputedVolume: 0
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Resolution Modal State
  const [selectedDispute, setSelectedDispute] = useState(null);
  const { run: runAction, busy: actionLoading } = useFinancialAction();

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [listRes, summaryData] = await Promise.all([
        apiGetPage('/admin/disputes', { page, limit: 20, status: statusFilter, category: categoryFilter, search: debouncedSearch }),
        apiGet('/admin/disputes/summary')
      ]);

      if (listRes.data?.success) {
        setDisputes(listRes.data.disputes || []);
        setTotalPages(listRes.data.totalPages || listRes.totalPages || 1);
      }

      if (summaryData?.success) {
        setSummary(summaryData.summary);
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load disputes.'));
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  // Resolutions can trigger refunds, so they carry an Idempotency-Key.
  const handleResolveSubmit = async (body) => {
    const target = selectedDispute;
    if (!target) return;
    const data = await runAction(
      `resolve-dispute:${target.id}`,
      (config) => apiPost(`/admin/disputes/${target.id}/resolve`, body, config),
      'Error resolving dispute'
    );
    if (data?.success) {
      showSuccess(data.message || 'Dispute resolved successfully');
      setSelectedDispute(null);
      fetchDisputes();
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
              Arbitration & Dispute Center
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Customer Disputes & Charge Inquiries
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">
            Review customer claims, inspect garage responses, and authorize full/partial refund resolutions
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDisputes}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Total Disputes</span>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{summary.totalDisputes}</div>
          <p className="text-[10px] font-medium text-slate-500 mt-0.5">All-time inquiries</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block mb-1">Open</span>
          <div className="text-2xl font-black text-amber-700 tracking-tight flex items-center gap-1">
            <Clock className="h-4 w-4 text-amber-500" />
            {summary.open}
          </div>
          <p className="text-[10px] font-medium text-amber-600 mt-0.5">Awaiting garage</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block mb-1">Under Review</span>
          <div className="text-2xl font-black text-teal-700 tracking-tight flex items-center gap-1">
            <Eye className="h-4 w-4 text-teal-500" />
            {summary.underReview}
          </div>
          <p className="text-[10px] font-medium text-teal-600 mt-0.5">Ready for decision</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">Resolved</span>
          <div className="text-2xl font-black text-emerald-700 tracking-tight flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            {summary.resolved}
          </div>
          <p className="text-[10px] font-medium text-emerald-600 mt-0.5">Successfully closed</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 block mb-1">Rejected</span>
          <div className="text-2xl font-black text-red-700 tracking-tight flex items-center gap-1">
            <X className="h-4 w-4 text-red-500" />
            {summary.rejected}
          </div>
          <p className="text-[10px] font-medium text-red-600 mt-0.5">Claim dismissed</p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Disputed Volume</span>
          <div className="text-xl font-black text-slate-900 tracking-tight flex items-center">
            <IndianRupee className="h-4 w-4 text-slate-500 mr-0.5" />
            {Number(summary.totalDisputedVolume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[10px] font-medium text-slate-500 mt-0.5">Claim amount total</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search disputes"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search dispute number, invoice, vehicle, garage..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'].map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={statusFilter === status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {status === 'ALL' ? 'All Disputes' : status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {loadError && <ErrorState message={loadError} onRetry={fetchDisputes} retrying={loading} />}

      {/* Table */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-16 px-4">
            <AlertTriangle className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Disputes Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Any customer service or billing disputes will appear here for administrative resolution.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 pl-6">Dispute ID</th>
                  <th className="py-3.5 px-4">Invoice / Garage</th>
                  <th className="py-3.5 px-4">Category / Subject</th>
                  <th className="py-3.5 px-4">Claimed Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created At</th>
                  <th className="py-3.5 px-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {disputes.map((d) => {
                  const isResolved = d.status === 'RESOLVED';
                  const isRejected = d.status === 'REJECTED';
                  const isOpen = d.status === 'OPEN';

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 pl-6 font-mono font-bold text-slate-900">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {d.disputeNumber}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-800 block">{d.invoiceNumber}</span>
                        <span className="text-[11px] text-slate-500 block truncate max-w-[140px]">{d.garageName}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-900 block truncate max-w-[200px]">{d.subject}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{d.category?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-4 px-4 font-black text-slate-900">
                        ₹{Number(d.disputedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> RESOLVED
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-red-50 text-red-700 border border-red-200">
                            REJECTED
                          </span>
                        ) : isOpen ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="h-3 w-3" /> OPEN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                            UNDER REVIEW
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-500 text-[11px]">
                        {d.date ? new Date(d.date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-4 px-4 pr-6 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedDispute(d)}
                          className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>{isResolved || isRejected ? 'Inspect' : 'Resolve'}</span>
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
                aria-label="Previous page"
                disabled={page === 1}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                disabled={page === totalPages}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Admin Resolution Modal */}
      <DisputeResolutionModal
        key={selectedDispute?.id || 'none'}
        dispute={selectedDispute}
        onClose={() => setSelectedDispute(null)}
        onSubmit={handleResolveSubmit}
        submitting={actionLoading}
      />
    </div>
  );
};

export default AdminDisputes;
