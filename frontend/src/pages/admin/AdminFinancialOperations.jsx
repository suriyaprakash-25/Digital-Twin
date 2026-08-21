import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Receipt,
  Scale,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Lock,
  RotateCcw,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Building2,
  CreditCard,
  UserCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import SettlementReviewModal from '../../components/settlement/SettlementReviewModal';

export default function AdminFinancialOperations() {
  const { showSuccess, showError } = useToast();
  const [summary, setSummary] = useState({
    pendingAmount: 0,
    pendingCount: 0,
    underReviewAmount: 0,
    underReviewCount: 0,
    highValuePendingAmount: 0,
    highValuePendingCount: 0,
    processingAmount: 0,
    processingCount: 0,
    settledAmount: 0,
    settledCount: 0,
    failedCount: 0,
    retryQueueCount: 0,
    activeHoldsCount: 0
  });

  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL_PENDING'); // 'ALL_PENDING' | 'HIGH_VALUE' | 'HOLDS'
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [search, setSearch] = useState('');

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/financial-operations/summary`, { headers: getAuthHeaders() });
      if (res.data?.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Error loading operations summary:', err);
    }
  };

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'HIGH_VALUE'
        ? `${API_BASE_URL}/admin/settlements/high-value`
        : `${API_BASE_URL}/admin/settlements/pending`;

      const res = await axios.get(endpoint, { headers: getAuthHeaders() });
      if (res.data?.success) {
        setSettlements(res.data.settlements || []);
      }
    } catch (err) {
      showError('Failed to load settlements');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchSummary();
    fetchSettlements();
  }, [fetchSummary, fetchSettlements]);

  const filteredSettlements = settlements.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.settlementId && s.settlementId.toLowerCase().includes(q)) ||
      (s.garageId && s.garageId.toLowerCase().includes(q)) ||
      (s.requestedBy && s.requestedBy.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Financial Operations & Settlement Governance</h1>
              <p className="text-xs text-slate-400">Maker-Checker dual authorization, settlement holds, automated retry queues and payout execution</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => { fetchSummary(); fetchSettlements(); }}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* 7 Operational KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pending Amount</span>
          <span className="text-xl font-black text-white">₹{summary.pendingAmount.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-cyan-400 block mt-1">{summary.pendingCount} Requests</span>
        </div>

        <div className="bg-slate-900/60 border border-purple-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">Under Review</span>
          <span className="text-xl font-black text-purple-400">₹{summary.underReviewAmount.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">{summary.underReviewCount} Under Audit</span>
        </div>

        <div className="bg-slate-900/60 border border-indigo-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">High-Value Queue</span>
          <span className="text-xl font-black text-indigo-400">₹{summary.highValuePendingAmount.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-indigo-300 block mt-1">{summary.highValuePendingCount} Awaiting 2nd Approval</span>
        </div>

        <div className="bg-slate-900/60 border border-blue-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-1">Processing</span>
          <span className="text-xl font-black text-blue-400">₹{summary.processingAmount.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">{summary.processingCount} In Gateway</span>
        </div>

        <div className="bg-slate-900/60 border border-emerald-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Settled Volume</span>
          <span className="text-xl font-black text-emerald-400">₹{summary.settledAmount.toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">{summary.settledCount} Transfers Completed</span>
        </div>

        <div className="bg-slate-900/60 border border-amber-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Active Holds</span>
          <span className="text-xl font-black text-amber-400">{summary.activeHoldsCount}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Payouts Locked</span>
        </div>

        <div className="bg-slate-900/60 border border-red-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block mb-1">Retry Queue</span>
          <span className="text-xl font-black text-red-400">{summary.retryQueueCount}</span>
          <span className="text-[10px] text-slate-500 block mt-1">{summary.failedCount} Failed Permanently</span>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {[
            { id: 'ALL_PENDING', label: 'Pending & Review Queue', icon: Clock },
            { id: 'HIGH_VALUE', label: 'High-Value Dual Approvals', icon: UserCheck }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="pb-2 md:pb-0">
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ID or Garage..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Settlement ID</th>
                <th className="px-6 py-3.5">Garage</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5">Maker-Checker</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading settlement operations queue...
                  </td>
                </tr>
              ) : filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    No settlements currently awaiting operational review.
                  </td>
                </tr>
              ) : (
                filteredSettlements.map((s) => {
                  const reqAmt = parseFloat(s.approvedAmount || s.requestedAmount) || 0;
                  const reqApps = s.requiredApprovalCount || (s.isHighValue ? 2 : 1);
                  const curApps = s.approvalCount || (s.approvals ? s.approvals.length : 0);

                  return (
                    <tr key={s._id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-3.5 font-mono font-semibold text-cyan-400">
                        {s.settlementId}
                        {s.isHighValue && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                            HIGH-VALUE
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-white font-medium">{s.garageName || s.garageId}</td>
                      <td className="px-6 py-3.5 font-bold text-white">₹{reqAmt.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          curApps >= reqApps ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {curApps}/{reqApps} Approvals
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.status === 'APPROVED' ? 'bg-blue-500/10 text-blue-400' :
                          s.status === 'UNDER_REVIEW' ? 'bg-purple-500/10 text-purple-400' :
                          'bg-cyan-500/10 text-cyan-400'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-400 text-[11px]">
                        {new Date(s.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedSettlement(s)}
                          className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-semibold transition"
                        >
                          Review Payout
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSettlement && (
        <SettlementReviewModal
          settlement={selectedSettlement}
          onClose={() => setSelectedSettlement(null)}
          onUpdated={() => {
            fetchSummary();
            fetchSettlements();
          }}
        />
      )}

    </div>
  );
}
