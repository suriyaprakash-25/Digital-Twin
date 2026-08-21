import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Landmark,
  Clock,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Search,
  Scale,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function AdminTreasury() {
  const { showError } = useToast();
  const [forecast, setForecast] = useState(null);
  const [aging, setAging] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBucket, setSelectedBucket] = useState('ALL');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fRes, aRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/admin/treasury/forecast`, { headers: getAuthHeaders() }),
        axios.get(`${API_BASE_URL}/admin/treasury/aging`, { headers: getAuthHeaders() })
      ]);

      if (fRes.data?.success) setForecast(fRes.data.forecast);
      if (aRes.data?.success) setAging(aRes.data.aging);
    } catch (err) {
      showError('Failed to load treasury operations data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const detailedRecords = aging?.detailedAgingRecords || [];
  const filteredRecords = detailedRecords.filter(r => {
    const matchSearch = !search ||
      (r.settlementId && r.settlementId.toLowerCase().includes(search.toLowerCase())) ||
      (r.garageName && r.garageName.toLowerCase().includes(search.toLowerCase()));

    const matchBucket = selectedBucket === 'ALL' || r.agingBucket === selectedBucket;
    return matchSearch && matchBucket;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Treasury Liquidity & Settlement Intelligence</h1>
              <p className="text-xs text-slate-400">Automated payout forecasting, settlement velocity, aging buckets, and SLA breach monitoring</p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* 7 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-slate-900/60 border border-emerald-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Available Platform Balance</span>
          <span className="text-xl font-black text-white">₹{((forecast?.currentAvailableBalance || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Ready for Payout</span>
        </div>

        <div className="bg-slate-900/60 border border-cyan-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">Pending Settlements</span>
          <span className="text-xl font-black text-cyan-400">₹{((forecast?.pendingSettlementAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">In Queue</span>
        </div>

        <div className="bg-slate-900/60 border border-blue-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-1">In Processing</span>
          <span className="text-xl font-black text-blue-400">₹{((forecast?.processingAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Gateway Execution</span>
        </div>

        <div className="bg-slate-900/60 border border-indigo-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">7-Day Forecast</span>
          <span className="text-xl font-black text-indigo-400">₹{((forecast?.projected7DayPayout || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Projected Payout</span>
        </div>

        <div className="bg-slate-900/60 border border-purple-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">30-Day Forecast</span>
          <span className="text-xl font-black text-purple-400">₹{((forecast?.projected30DayPayout || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Projected Volume</span>
        </div>

        <div className="bg-slate-900/60 border border-amber-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">SLA Breaches</span>
          <span className="text-xl font-black text-amber-400">{aging?.slaBreachesCount || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Delayed Settlements</span>
        </div>

        <div className="bg-slate-900/60 border border-red-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block mb-1">Failure Rate</span>
          <span className="text-xl font-black text-red-400">{forecast?.failedSettlementRate || 0}%</span>
          <span className="text-[10px] text-slate-500 block mt-1">Past 30 Days</span>
        </div>
      </div>

      {/* Aging Buckets Distribution */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-black uppercase tracking-wider text-white">Settlement Aging Distribution</h2>
          </div>
          <span className="text-xs text-slate-400">Total Open: {aging?.totalOpenSettlements || 0}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {aging?.bucketSummaries && Object.entries(aging.bucketSummaries).map(([bucketKey, bData]) => (
            <button
              key={bucketKey}
              onClick={() => setSelectedBucket(selectedBucket === bucketKey ? 'ALL' : bucketKey)}
              className={`p-3.5 rounded-xl border text-left transition ${
                selectedBucket === bucketKey
                  ? 'bg-cyan-500/10 border-cyan-500/50'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                {bucketKey.replace('_', ' ')}
              </span>
              <span className="text-lg font-black text-white block">₹{bData.amountRupees.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-cyan-400">{bData.count} settlement(s)</span>
            </button>
          ))}
        </div>
      </div>

      {/* SLA Breaches Banner if any */}
      {aging?.slaBreaches && aging.slaBreaches.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-amber-300">SLA Delays Detected</h3>
              <p className="text-[11px] text-slate-400">{aging.slaBreaches.length} settlement(s) currently exceed configured review or processing SLA limits.</p>
            </div>
          </div>
        </div>
      )}

      {/* Open Settlements Aging Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden space-y-4">
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Settlement Aging Queue</h3>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search settlement or garage..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Settlement ID</th>
                <th className="px-6 py-3.5">Garage</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Age</th>
                <th className="px-6 py-3.5">Aging Bucket</th>
                <th className="px-6 py-3.5">SLA Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading treasury intelligence queue...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    No unsettled records matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.settlementId} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3.5 font-mono font-semibold text-cyan-400">{r.settlementId}</td>
                    <td className="px-6 py-3.5 text-white font-medium">{r.garageName}</td>
                    <td className="px-6 py-3.5 font-bold text-white">₹{r.amountRupees.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400">{r.ageDays} days ({r.ageHours}h)</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                        {r.agingBucket}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {r.isSlaBreached ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          {r.breachType}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                          WITHIN SLA
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
