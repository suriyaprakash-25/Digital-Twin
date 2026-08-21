import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function AdminRiskCases() {
  const { showSuccess, showError } = useToast();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        level: levelFilter !== 'ALL' ? levelFilter : undefined,
        search: search || undefined
      };

      const res = await axios.get(`${API_BASE_URL}/api/admin/risk-cases`, { params, headers: getAuthHeaders() });
      if (res.data?.success) {
        setCases(res.data.riskCases || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.totalCount || 0);
      }
    } catch (err) {
      showError('Failed to load risk cases');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, levelFilter, search]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleAction = async (actionType) => {
    if (!selectedCase) return;
    setActionLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/risk-cases/${selectedCase.riskCaseNumber}/action`,
        { action: actionType, note: actionNote },
        { headers: getAuthHeaders() }
      );

      if (res.data?.success) {
        showSuccess(`Action ${actionType} executed successfully`);
        setSelectedCase(null);
        setActionNote('');
        fetchCases();
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to execute risk action');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (resolutionStatus) => {
    if (!selectedCase) return;
    setActionLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/admin/risk-cases/${selectedCase.riskCaseNumber}/resolve`,
        { resolutionStatus, resolutionNote: actionNote },
        { headers: getAuthHeaders() }
      );

      if (res.data?.success) {
        showSuccess(`Case resolved as ${resolutionStatus}`);
        setSelectedCase(null);
        setActionNote('');
        fetchCases();
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to resolve risk case');
    } finally {
      setActionLoading(false);
    }
  };

  const getLevelBadge = (level) => {
    if (level === 'CRITICAL') return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">CRITICAL</span>;
    if (level === 'HIGH') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">HIGH</span>;
    if (level === 'MEDIUM') return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40">MEDIUM</span>;
    return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">LOW</span>;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-500 to-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-red-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Financial Risk Cases & Fraud Intelligence</h1>
              <p className="text-xs text-slate-400">Multi-entity risk correlation across Users, Garages, Vehicles, Payments, Disputes & Settlements</p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchCases}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search case #, garage, user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500"
            />
          </div>

          <select
            value={levelFilter}
            onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">Critical (80-100)</option>
            <option value="HIGH">High (60-79)</option>
            <option value="MEDIUM">Medium (30-59)</option>
            <option value="LOW">Low (0-29)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
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

        <span className="text-xs text-slate-400">Total Cases: {totalCount}</span>
      </div>

      {/* Risk Cases Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
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
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-400" />
                    Loading correlated risk cases...
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    No risk cases matching your criteria.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3.5 font-mono font-semibold text-red-400">{c.riskCaseNumber}</td>
                    <td className="px-6 py-3.5">{getLevelBadge(c.riskLevel)}</td>
                    <td className="px-6 py-3.5 font-bold text-white">{c.score} / 100</td>
                    <td className="px-6 py-3.5 text-slate-300">
                      <div className="flex flex-col gap-0.5 text-[11px]">
                        {c.entities?.garageId && <span>Garage: {c.entities.garageId}</span>}
                        {c.entities?.userId && <span>User: {c.entities.userId}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {c.signals?.map((s, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-300">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
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

      {/* Investigation Dossier Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white">{selectedCase.riskCaseNumber}</h3>
                <span className="text-xs text-slate-400">Risk Investigation Dossier</span>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Score & Badges */}
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Risk Score</span>
                <span className="text-2xl font-black text-white">{selectedCase.score} / 100</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block mb-1">Risk Level</span>
                {getLevelBadge(selectedCase.riskLevel)}
              </div>
            </div>

            {/* Evidence & Signals */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Explainable Signals Triggered</h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedCase.signals?.map((s, i) => (
                  <span key={i} className="px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-semibold">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Evidence JSON summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Correlated Entity Evidence</h4>
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-300 font-mono overflow-x-auto">
                {JSON.stringify(selectedCase.evidence || {}, null, 2)}
              </pre>
            </div>

            {/* Action Note input */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Investigation Note / Justification</label>
              <textarea
                rows={2}
                placeholder="Enter investigation findings, rationale, or instructions..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500"
              />
            </div>

            {/* Admin Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                disabled={actionLoading}
                onClick={() => handleAction('HOLD_SETTLEMENT')}
                className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition"
              >
                Place Settlement Hold
              </button>

              <button
                disabled={actionLoading}
                onClick={() => handleAction('ESCALATE')}
                className="px-3.5 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition"
              >
                Escalate Case
              </button>

              <button
                disabled={actionLoading}
                onClick={() => handleResolve('FALSE_POSITIVE')}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                False Positive
              </button>

              <button
                disabled={actionLoading}
                onClick={() => handleResolve('CONFIRMED')}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition"
              >
                Confirm Fraud
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
