import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Flame,
  AlertCircle
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import RiskDetailsModal from '../../components/risk/RiskDetailsModal';

export default function AdminPaymentRisk() {
  const { showSuccess, showError } = useToast();
  const [summary, setSummary] = useState({
    totalFlagged: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    openCount: 0,
    reviewedCount: 0
  });

  const [riskEvents, setRiskEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Filters
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/risk/summary`, { headers: getAuthHeaders() });
      if (res.data?.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Error fetching risk summary:', err);
    }
  };

  const fetchRiskEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        level: levelFilter,
        status: statusFilter,
        search
      };
      const res = await axios.get(`${API_BASE_URL}/admin/risk`, { params, headers: getAuthHeaders() });
      if (res.data?.success) {
        setRiskEvents(res.data.riskEvents || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.totalCount || 0);
      }
    } catch (err) {
      showError('Failed to load risk events');
    } finally {
      setLoading(false);
    }
  }, [page, levelFilter, statusFilter, search]);

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchRiskEvents();
  }, [fetchRiskEvents]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRiskEvents();
  };

  const getRiskBadge = (level, score) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-950/80 text-red-300 border border-red-800">
            <Flame className="w-3 h-3 text-red-400" />
            CRITICAL ({score})
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-950/80 text-orange-300 border border-orange-800">
            <AlertTriangle className="w-3 h-3 text-orange-400" />
            HIGH ({score})
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            MEDIUM ({score})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            LOW ({score})
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">OPEN</span>;
      case 'REVIEWED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">REVIEWED</span>;
      case 'CLEARED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">CLEARED</span>;
      case 'ESCALATED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">ESCALATED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-red-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Payment Risk & Security Console</h1>
              <p className="text-xs text-slate-400">Deterministic fraud scoring, signal monitoring & financial audit protection</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => { fetchSummary(); fetchRiskEvents(); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Flagged</span>
          <span className="text-2xl font-black text-white">{summary.totalFlagged}</span>
        </div>
        <div className="bg-slate-900/60 border border-red-900/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block mb-1">Critical Risk</span>
          <span className="text-2xl font-black text-red-400">{summary.criticalCount}</span>
        </div>
        <div className="bg-slate-900/60 border border-orange-900/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block mb-1">High Risk</span>
          <span className="text-2xl font-black text-orange-400">{summary.highCount}</span>
        </div>
        <div className="bg-slate-900/60 border border-amber-900/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Medium Risk</span>
          <span className="text-2xl font-black text-amber-400">{summary.mediumCount}</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Open Reviews</span>
          <span className="text-2xl font-black text-cyan-400">{summary.openCount}</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Resolved</span>
          <span className="text-2xl font-black text-emerald-400">{summary.reviewedCount}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payment ID, invoice, user..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Level Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">Risk:</span>
            <select
              value={levelFilter}
              onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Levels</option>
              <option value="CRITICAL" className="bg-slate-900">Critical</option>
              <option value="HIGH" className="bg-slate-900">High</option>
              <option value="MEDIUM" className="bg-slate-900">Medium</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Statuses</option>
              <option value="OPEN" className="bg-slate-900">Open</option>
              <option value="REVIEWED" className="bg-slate-900">Reviewed</option>
              <option value="CLEARED" className="bg-slate-900">Cleared</option>
              <option value="ESCALATED" className="bg-slate-900">Escalated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Risk Events Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Transaction / ID</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Risk Evaluation</th>
                <th className="px-6 py-4">Triggered Signals</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading risk events...
                  </td>
                </tr>
              ) : riskEvents.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-60" />
                    No risk events found matching the specified filters.
                  </td>
                </tr>
              ) : (
                riskEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white uppercase text-[11px] mb-0.5">{evt.operation || 'PAYMENT'}</div>
                      <div className="font-mono text-[11px] text-cyan-400">{evt.invoiceId || evt.paymentId || evt.id}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      ₹{parseFloat(evt.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4">
                      {getRiskBadge(evt.riskLevel, evt.riskScore)}
                    </td>
                    <td className="px-6 py-4">
                      {evt.riskFlags && evt.riskFlags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {evt.riskFlags.map((flag, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                              {flag.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(evt.status)}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-[11px]">
                      {new Date(evt.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 transition shadow-sm"
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

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, totalCount)} of {totalCount} events
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

      {/* Risk Inspection Modal */}
      {selectedEvent && (
        <RiskDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdated={() => { fetchSummary(); fetchRiskEvents(); }}
        />
      )}

    </div>
  );
}
