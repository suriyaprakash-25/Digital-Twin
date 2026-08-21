import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function AdminFinancialAlerts() {
  const { showSuccess, showError } = useToast();
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      };

      const [listRes, sumRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/admin/alerts`, { params, headers: getAuthHeaders() }),
        axios.get(`${API_BASE_URL}/admin/alerts/summary`, { headers: getAuthHeaders() })
      ]);

      if (listRes.data?.success) {
        setAlerts(listRes.data.alerts || []);
        setTotalPages(listRes.data.totalPages || 1);
        setTotalCount(listRes.data.totalCount || 0);
      }
      if (sumRes.data?.success) {
        setSummary(sumRes.data.summary);
      }
    } catch (err) {
      showError('Failed to load financial alerts');
    } finally {
      setLoading(false);
    }
  }, [page, severityFilter, statusFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId) => {
    setActionLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/admin/alerts/${alertId}/acknowledge`, {}, { headers: getAuthHeaders() });
      if (res.data?.success) {
        showSuccess('Alert acknowledged');
        fetchAlerts();
        if (selectedAlert) setSelectedAlert(null);
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to acknowledge alert');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (alertId) => {
    setActionLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/admin/alerts/${alertId}/resolve`,
        { resolutionNote: resolveNote },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        showSuccess('Alert resolved successfully');
        setResolveNote('');
        setSelectedAlert(null);
        fetchAlerts();
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to resolve alert');
    } finally {
      setActionLoading(false);
    }
  };

  const getSeverityBadge = (sev) => {
    if (sev === 'CRITICAL') return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">CRITICAL</span>;
    if (sev === 'HIGH') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">HIGH</span>;
    if (sev === 'WARNING') return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-500/20 text-yellow-400">WARNING</span>;
    return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">INFO</span>;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-500 to-rose-600 flex items-center justify-center text-white font-bold shadow-lg shadow-red-500/20">
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Financial Observability & System Alerts</h1>
              <p className="text-xs text-slate-400">Real-time alerts for payment anomalies, settlement failures, treasury thresholds & integrity issues</p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchAlerts}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Open Alerts</span>
          <span className="text-2xl font-black text-white">{summary?.openAlerts || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Requires Attention</span>
        </div>

        <div className="bg-slate-900/60 border border-red-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block mb-1">Critical Severity</span>
          <span className="text-2xl font-black text-red-400">{summary?.criticalAlerts || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Immediate Action</span>
        </div>

        <div className="bg-slate-900/60 border border-amber-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">High Severity</span>
          <span className="text-2xl font-black text-amber-400">{summary?.highAlerts || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Priority Review</span>
        </div>

        <div className="bg-slate-900/60 border border-blue-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Acknowledged</span>
          <span className="text-2xl font-black text-blue-400">{summary?.acknowledgedAlerts || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Under Investigation</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <span className="text-xs text-slate-400">Total Filtered: {totalCount}</span>
      </div>

      {/* Alerts Queue Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
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
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-400" />
                    Loading financial alerts...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    No alerts matching your criteria.
                  </td>
                </tr>
              ) : (
                alerts.map((alt) => (
                  <tr key={alt._id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3.5 font-mono font-semibold text-rose-400">{alt.alertNumber}</td>
                    <td className="px-6 py-3.5">{getSeverityBadge(alt.severity)}</td>
                    <td className="px-6 py-3.5 font-semibold text-white">{alt.alertType}</td>
                    <td className="px-6 py-3.5 text-slate-300 max-w-xs truncate">{alt.message}</td>
                    <td className="px-6 py-3.5 text-slate-400">
                      {alt.createdAt ? new Date(alt.createdAt).toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {alt.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedAlert(alt)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
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
          <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, totalCount)} of {totalCount} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-300 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Alert Investigation Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-6 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white">{selectedAlert.alertNumber}</h3>
                <span className="text-xs text-slate-400">{selectedAlert.alertType}</span>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Severity:</span>
                {getSeverityBadge(selectedAlert.severity)}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-white">{selectedAlert.status}</span>
              </div>
              <div className="pt-2 border-t border-slate-900">
                <span className="text-slate-400 block mb-1">Message:</span>
                <p className="text-white font-medium">{selectedAlert.message}</p>
              </div>
            </div>

            {selectedAlert.status !== 'RESOLVED' && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Resolution Note</label>
                <textarea
                  rows={2}
                  placeholder="Enter resolution details, action taken..."
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              {selectedAlert.status === 'OPEN' && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleAcknowledge(selectedAlert.alertNumber)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
                >
                  Acknowledge Alert
                </button>
              )}

              {selectedAlert.status !== 'RESOLVED' && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleResolve(selectedAlert.alertNumber)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
                >
                  Resolve Alert
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
