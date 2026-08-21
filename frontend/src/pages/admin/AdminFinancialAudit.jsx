import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  ShieldAlert,
  User,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Receipt
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function AdminFinancialAudit() {
  const { showError } = useToast();
  const [summary, setSummary] = useState({
    totalLogs: 0,
    settlementActions: 0,
    refundActions: 0,
    paymentActions: 0,
    disputeActions: 0
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/financial-audit/summary`, { headers: getAuthHeaders() });
      if (res.data?.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Error fetching audit summary:', err);
    }
  };

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined
      };

      const res = await axios.get(`${API_BASE_URL}/api/admin/financial-audit`, { params, headers: getAuthHeaders() });
      if (res.data?.success) {
        setLogs(res.data.auditLogs || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.totalCount || 0);
      }
    } catch (err) {
      showError('Failed to load financial audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, dateFrom, dateTo, search]);

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const getActionBadge = (action) => {
    if (action.startsWith('SETTLEMENT_SETTLED') || action.startsWith('PAYMENT_VERIFIED')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">{action}</span>;
    }
    if (action.startsWith('SETTLEMENT_APPROVED')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">{action}</span>;
    }
    if (action.startsWith('SETTLEMENT_HOLD') || action.startsWith('REFUND_')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">{action}</span>;
    }
    if (action.startsWith('SETTLEMENT_REJECTED') || action.startsWith('DISPUTE_')) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">{action}</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">{action}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Financial Audit Ledger</h1>
              <p className="text-xs text-slate-400">Append-only immutable record of all financial mutations, approvals, and administrative actions</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => { fetchSummary(); fetchAuditLogs(); }}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* 5 KPI Badges */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Audit Records</span>
          <span className="text-xl font-black text-white">{summary.totalLogs.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Immutable Entries</span>
        </div>

        <div className="bg-slate-900/60 border border-blue-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Settlement Actions</span>
          <span className="text-xl font-black text-blue-400">{summary.settlementActions.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Approvals, Payouts, Holds</span>
        </div>

        <div className="bg-slate-900/60 border border-amber-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Refund Actions</span>
          <span className="text-xl font-black text-amber-400">{summary.refundActions.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Adjustments & Payouts</span>
        </div>

        <div className="bg-slate-900/60 border border-emerald-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Payment Verifications</span>
          <span className="text-xl font-black text-emerald-400">{summary.paymentActions.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Gateway Captures</span>
        </div>

        <div className="bg-slate-900/60 border border-purple-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">Dispute Actions</span>
          <span className="text-xl font-black text-purple-400">{summary.disputeActions.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Claims & Resolutions</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ID, actor, action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="ALL">All Actions</option>
            <option value="SETTLEMENT_CREATED">SETTLEMENT_CREATED</option>
            <option value="SETTLEMENT_APPROVED">SETTLEMENT_APPROVED</option>
            <option value="SETTLEMENT_REJECTED">SETTLEMENT_REJECTED</option>
            <option value="SETTLEMENT_HOLD_PLACED">SETTLEMENT_HOLD_PLACED</option>
            <option value="SETTLEMENT_HOLD_RELEASED">SETTLEMENT_HOLD_RELEASED</option>
            <option value="SETTLEMENT_SETTLED">SETTLEMENT_SETTLED</option>
            <option value="REFUND_ISSUED">REFUND_ISSUED</option>
            <option value="PAYMENT_VERIFIED">PAYMENT_VERIFIED</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white"
          />
          <span className="text-slate-500 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Actor</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Resource / Settlement</th>
                <th className="px-6 py-3.5">IP Address</th>
                <th className="px-6 py-3.5">State Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading audit trail records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    No financial audit records matching your criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3.5 text-slate-400 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white">{log.actorId || 'SYSTEM'}</span>
                        {log.actorRole && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400">
                            {log.actorRole}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">{getActionBadge(log.action)}</td>
                    <td className="px-6 py-3.5 font-mono text-cyan-400">
                      {log.settlementId || log.resourceId || '—'}
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 text-[11px] font-mono">{log.ip || '127.0.0.1'}</td>
                    <td className="px-6 py-3.5 text-slate-300 text-[11px] max-w-xs truncate">
                      {log.afterState ? JSON.stringify(log.afterState) : '—'}
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

    </div>
  );
}
