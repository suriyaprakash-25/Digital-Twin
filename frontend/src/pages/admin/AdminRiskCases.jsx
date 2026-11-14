import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  AlertTriangle,
  RefreshCw,
  Eye,
  Lock,
  User,
  Building2,
  Car,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText
} from 'lucide-react';
import { apiGetPage, apiPost, getErrorMessage } from '../../utils/api';
import { useToast } from '../../context/toastContextCore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import ErrorState from '../../components/common/ErrorState';
import RiskCaseDossierModal, { RiskLevelBadge } from '../../components/risk/RiskCaseDossierModal';

export default function AdminRiskCases() {
  const { showSuccess, showError } = useToast();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [selectedCase, setSelectedCase] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = {
        page,
        limit: 20,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        level: levelFilter !== 'ALL' ? levelFilter : undefined,
        search: debouncedSearch || undefined
      };

      const { data, total, totalPages: headerPages } = await apiGetPage('/admin/risk-cases', params);
      if (data?.success) {
        setCases(data.riskCases || []);
        setTotalPages(data.totalPages || headerPages || 1);
        setTotalCount(data.totalCount || total || 0);
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load risk cases'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, levelFilter, debouncedSearch]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Shared runner for dossier actions: one request at a time, consistent toasts.
  const runCaseAction = async (key, path, body, successMessage, errorMessage) => {
    if (!selectedCase || pendingAction) return;
    setPendingAction(key);
    try {
      const data = await apiPost(path, body);
      if (data?.success) {
        showSuccess(successMessage);
        setSelectedCase(null);
        setActionNote('');
        fetchCases();
      }
    } catch (err) {
      showError(getErrorMessage(err, errorMessage));
    } finally {
      setPendingAction(null);
    }
  };

  const handleAction = (actionType) => runCaseAction(
    actionType,
    `/admin/risk-cases/${selectedCase?.riskCaseNumber}/action`,
    { action: actionType, note: actionNote },
    `Action ${actionType} executed successfully`,
    'Failed to execute risk action'
  );

  const handleResolve = (resolutionStatus) => runCaseAction(
    resolutionStatus,
    `/admin/risk-cases/${selectedCase?.riskCaseNumber}/resolve`,
    { resolutionStatus, resolutionNote: actionNote },
    `Case resolved as ${resolutionStatus}`,
    'Failed to resolve risk case'
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-500 to-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-red-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Financial Risk Cases & Fraud Intelligence</h1>
              <p className="text-xs text-slate-500">Multi-entity risk correlation across Users, Garages, Vehicles, Payments, Disputes & Settlements</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchCases}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search risk cases"
              placeholder="Search case #, garage, user..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-500"
            />
          </div>

          <select
            aria-label="Filter by risk level"
            value={levelFilter}
            onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">Critical (80-100)</option>
            <option value="HIGH">High (60-79)</option>
            <option value="MEDIUM">Medium (30-59)</option>
            <option value="LOW">Low (0-29)</option>
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="ESCALATED">Escalated</option>
            <option value="CONFIRMED">Confirmed Fraud</option>
            <option value="FALSE_POSITIVE">False Positive</option>
            <option value="CLEARED">Cleared</option>
          </select>
        </div>

        <span className="text-xs text-slate-500">Total Cases: {totalCount}</span>
      </div>

      {loadError && <ErrorState message={loadError} onRetry={fetchCases} retrying={loading} />}

      {/* Risk Cases Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Case #</th>
                <th className="px-6 py-3.5">Risk Level</th>
                <th className="px-6 py-3.5">Score</th>
                <th className="px-6 py-3.5">Correlated Entities</th>
                <th className="px-6 py-3.5">Signals</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-400" />
                    Loading correlated risk cases...
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No risk cases matching your criteria.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-100/40 transition">
                    <td className="px-6 py-3.5 font-mono font-semibold text-red-400">{c.riskCaseNumber}</td>
                    <td className="px-6 py-3.5"><RiskLevelBadge level={c.riskLevel} /></td>
                    <td className="px-6 py-3.5 font-bold text-slate-900">{c.score} / 100</td>
                    <td className="px-6 py-3.5 text-slate-600">
                      <div className="flex flex-col gap-0.5 text-[11px]">
                        {c.entities?.garageId && <span>Garage: {c.entities.garageId}</span>}
                        {c.entities?.userId && <span>User: {c.entities.userId}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {c.signals?.map((s, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedCase(c)}
                        className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold transition"
                      >
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, totalCount)} of {totalCount} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                aria-label="Previous page"
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-700 text-slate-600 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <span className="text-xs font-semibold text-slate-600 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-700 text-slate-600 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Investigation Dossier Modal */}
      <RiskCaseDossierModal
        riskCase={selectedCase}
        onClose={() => setSelectedCase(null)}
        note={actionNote}
        onNoteChange={setActionNote}
        pendingAction={pendingAction}
        onAction={handleAction}
        onResolve={handleResolve}
      />

    </div>
  );
}
