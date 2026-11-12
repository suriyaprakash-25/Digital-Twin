import { useState, useEffect, useCallback } from 'react';
import {
  BellRing,
  AlertTriangle,
  CheckCircle,
  Search,
  RefreshCw,
  Clock,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check
} from 'lucide-react';
import { apiGet, apiGetPage, apiPost, getErrorMessage } from '../../utils/api';
import { useToast } from '../../context/toastContextCore';
import ErrorState from '../../components/common/ErrorState';
import AlertInvestigationModal, { SeverityBadge } from '../../components/admin/AlertInvestigationModal';

export default function AdminFinancialAlerts() {
  const { showSuccess, showError } = useToast();
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = {
        page,
        limit: 20,
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      };

      const [listRes, sumData] = await Promise.all([
        apiGetPage('/admin/alerts', params),
        apiGet('/admin/alerts/summary')
      ]);

      if (listRes.data?.success) {
        setAlerts(listRes.data.alerts || []);
        setTotalPages(listRes.data.totalPages || listRes.totalPages || 1);
        setTotalCount(listRes.data.totalCount || listRes.total || 0);
      }
      if (sumData?.success) {
        setSummary(sumData.summary);
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load financial alerts'));
    } finally {
      setLoading(false);
    }
  }, [page, severityFilter, statusFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId) => {
    if (pendingAction) return;
    setPendingAction('acknowledge');
    try {
      const data = await apiPost(`/admin/alerts/${alertId}/acknowledge`, {});
      if (data?.success) {
        showSuccess('Alert acknowledged');
        fetchAlerts();
        if (selectedAlert) setSelectedAlert(null);
      }
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to acknowledge alert'));
    } finally {
      setPendingAction(null);
    }
  };

  const handleResolve = async (alertId) => {
    if (pendingAction) return;
    setPendingAction('resolve');
    try {
      const data = await apiPost(`/admin/alerts/${alertId}/resolve`, { resolutionNote: resolveNote });
      if (data?.success) {
        showSuccess('Alert resolved successfully');
        setResolveNote('');
        setSelectedAlert(null);
        fetchAlerts();
      }
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to resolve alert'));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-500 to-rose-600 flex items-center justify-center text-slate-900 font-bold shadow-lg shadow-red-500/20">
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Financial Observability & System Alerts</h1>
              <p className="text-xs text-slate-500">Real-time alerts for payment anomalies, settlement failures, treasury thresholds & integrity issues</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchAlerts}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Open Alerts</span>
          <span className="text-2xl font-black text-slate-900">{summary?.openAlerts || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Requires Attention</span>
        </div>

        <div className="bg-white border border-red-100 bg-red-50/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block mb-1">Critical Severity</span>
          <span className="text-2xl font-black text-red-400">{summary?.criticalAlerts || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Immediate Action</span>
        </div>

        <div className="bg-white border border-amber-100 bg-amber-50/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">High Severity</span>
          <span className="text-2xl font-black text-amber-400">{summary?.highAlerts || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Priority Review</span>
        </div>

        <div className="bg-white border border-blue-100 bg-blue-50/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Acknowledged</span>
          <span className="text-2xl font-black text-blue-400">{summary?.acknowledgedAlerts || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Under Investigation</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter by severity"
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <span className="text-xs text-slate-500">Total Filtered: {totalCount}</span>
      </div>

      {loadError && <ErrorState message={loadError} onRetry={fetchAlerts} retrying={loading} />}

      {/* Alerts Queue Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Alert #</th>
                <th className="px-6 py-3.5">Severity</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5">Message</th>
                <th className="px-6 py-3.5">Created At</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-400" />
                    Loading financial alerts...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No alerts matching your criteria.
                  </td>
                </tr>
              ) : (
                alerts.map((alt) => (
                  <tr key={alt._id} className="hover:bg-slate-100/40 transition">
                    <td className="px-6 py-3.5 font-mono font-semibold text-rose-400">{alt.alertNumber}</td>
                    <td className="px-6 py-3.5"><SeverityBadge severity={alt.severity} /></td>
                    <td className="px-6 py-3.5 font-semibold text-slate-900">{alt.alertType}</td>
                    <td className="px-6 py-3.5 text-slate-600 max-w-xs truncate">{alt.message}</td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {alt.createdAt ? new Date(alt.createdAt).toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        {alt.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedAlert(alt)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-700 text-slate-900 rounded-lg text-xs font-semibold transition"
                      >
                        Inspect
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

      {/* Alert Investigation Modal */}
      <AlertInvestigationModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        resolveNote={resolveNote}
        onResolveNoteChange={setResolveNote}
        pendingAction={pendingAction}
        onAcknowledge={handleAcknowledge}
        onResolve={handleResolve}
      />

    </div>
  );
}
