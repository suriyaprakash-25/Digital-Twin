import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  IndianRupee,
  Receipt,
  Percent,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Scale,
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function AdminFinancialReports() {
  const { showSuccess, showError } = useToast();
  const [period, setPeriod] = useState('30_DAYS');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [summary, setSummary] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [commissionSummary, setCommissionSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Active sub-tab: 'COMMISSIONS' | 'TRANSACTIONS' | 'TRENDS'
  const [activeTab, setActiveTab] = useState('COMMISSIONS');

  const fetchFinancialReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = { period };
      if (period === 'CUSTOM') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }

      // 1. Platform Summary
      const sumRes = await axios.get(`${API_BASE_URL}/api/admin/reports/summary`, { params, headers: getAuthHeaders() });
      if (sumRes.data?.success) {
        setSummary(sumRes.data.summary);
      }

      // 2. Commissions Report
      const comRes = await axios.get(`${API_BASE_URL}/api/admin/reports/commissions`, { params, headers: getAuthHeaders() });
      if (comRes.data?.success) {
        setCommissions(comRes.data.commissions || []);
        setCommissionSummary(comRes.data.summary);
      }

      // 3. Transactions Report
      const txRes = await axios.get(`${API_BASE_URL}/api/admin/reports/transactions`, { params: { ...params, limit: 15 }, headers: getAuthHeaders() });
      if (txRes.data?.success) {
        setTransactions(txRes.data.transactions || []);
      }
    } catch (err) {
      showError('Failed to load platform financial reports');
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo]);

  useEffect(() => {
    fetchFinancialReports();
  }, [fetchFinancialReports]);

  const handleExport = async (reportType = 'TRANSACTIONS', format = 'csv') => {
    setIsExporting(true);
    try {
      const params = { period, format, reportType };
      if (period === 'CUSTOM') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }

      const res = await axios.get(`${API_BASE_URL}/api/admin/reports/export`, {
        params,
        headers: getAuthHeaders(),
        responseType: 'blob'
      });

      const blob = new Blob([res.data], {
        type: format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DrivePortz_${reportType}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showSuccess(`Exported ${reportType} (${format.toUpperCase()}) successfully`);
    } catch (err) {
      showError('Failed to export platform report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Platform Financial Reports & Analytics</h1>
              <p className="text-xs text-slate-400">Authoritative GMV aggregation, historical commission audits & multi-format exports</p>
            </div>
          </div>
        </div>

        {/* Global Export Center Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleExport('TRANSACTIONS', 'csv')}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export Transactions (CSV)
          </button>
          <button
            onClick={() => handleExport('COMMISSIONS', 'xlsx')}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-950/80 border border-emerald-800 hover:border-emerald-700 rounded-xl text-xs font-bold text-emerald-300 hover:text-emerald-200 transition shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Export Commissions (Excel)
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-300">Period:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'TODAY', label: 'Today' },
            { id: '7_DAYS', label: '7 Days' },
            { id: '30_DAYS', label: '30 Days' },
            { id: 'THIS_MONTH', label: 'This Month' },
            { id: 'LAST_MONTH', label: 'Last Month' },
            { id: 'THIS_YEAR', label: 'This Year' },
            { id: 'CUSTOM', label: 'Custom' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                period === p.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'CUSTOM' && (
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
        )}
      </div>

      {/* Platform Financial KPI Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total GMV</span>
            <span className="text-xl font-black text-white">₹{parseFloat(summary.totalGMV || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">Gross Platform Volume</span>
          </div>

          <div className="bg-slate-900/60 border border-cyan-900/40 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">Platform Commission</span>
            <span className="text-xl font-black text-cyan-400">₹{parseFloat(summary.platformCommission || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">Net Platform Revenue</span>
          </div>

          <div className="bg-slate-900/60 border border-indigo-900/40 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Garage Payouts</span>
            <span className="text-xl font-black text-indigo-400">₹{parseFloat(summary.garageNetEarnings || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">Net Partner Earnings</span>
          </div>

          <div className="bg-slate-900/60 border border-red-900/40 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block mb-1">Total Refunds</span>
            <span className="text-xl font-black text-red-400">₹{parseFloat(summary.totalRefunds || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">Processed Refunds</span>
          </div>

          <div className="bg-slate-900/60 border border-emerald-900/40 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Total Settled</span>
            <span className="text-xl font-black text-emerald-400">₹{parseFloat(summary.totalSettlements || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">Paid to Garages</span>
          </div>

          <div className="bg-slate-900/60 border border-amber-900/40 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Pending Settlement</span>
            <span className="text-xl font-black text-amber-400">₹{parseFloat(summary.pendingSettlements || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">In Processing</span>
          </div>

          <div className="bg-slate-900/60 border border-purple-900/40 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">Disputes Impact</span>
            <span className="text-xl font-black text-purple-400">₹{parseFloat(summary.totalDisputedAmount || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">{summary.totalDisputesCount} Raised ({summary.resolvedDisputesCount} Resolved)</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        {[
          { id: 'COMMISSIONS', label: 'Platform Commissions Ledger', icon: Percent },
          { id: 'TRANSACTIONS', label: 'Platform Transactions', icon: Receipt },
          { id: 'TRENDS', label: 'Daily GMV & Commission Trends', icon: TrendingUp }
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

      {/* TAB CONTENT 1: COMMISSIONS */}
      {activeTab === 'COMMISSIONS' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Historical Commission Snapshots</h2>
              <p className="text-xs text-slate-400">All commissions calculated based on immutable rates captured at transaction time</p>
            </div>
            {commissionSummary && (
              <span className="text-xs font-mono font-bold text-cyan-400">
                Total Fees: ₹{commissionSummary.totalCommissionEarned.toLocaleString('en-IN')}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Invoice #</th>
                  <th className="px-6 py-3.5">Garage</th>
                  <th className="px-6 py-3.5">Gross Volume</th>
                  <th className="px-6 py-3.5">Commission Rate</th>
                  <th className="px-6 py-3.5">Platform Fee</th>
                  <th className="px-6 py-3.5">Garage Net</th>
                  <th className="px-6 py-3.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {commissions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      No commission records found for this period.
                    </td>
                  </tr>
                ) : (
                  commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-3.5 font-mono font-semibold text-cyan-400">{c.invoiceNumber || '—'}</td>
                      <td className="px-6 py-3.5 text-white">{c.garageName || 'Authorized Garage'}</td>
                      <td className="px-6 py-3.5 font-bold text-white">₹{parseFloat(c.grossAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-semibold text-amber-400">{c.commissionRate}%</td>
                      <td className="px-6 py-3.5 font-bold text-cyan-300">₹{parseFloat(c.platformCommission || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 text-emerald-400">₹{parseFloat(c.garageNetAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 text-right text-slate-400 text-[11px]">
                        {new Date(c.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: TRANSACTIONS */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Platform Transactions</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Invoice #</th>
                  <th className="px-6 py-3.5">Garage</th>
                  <th className="px-6 py-3.5">Gross Amount</th>
                  <th className="px-6 py-3.5">Commission</th>
                  <th className="px-6 py-3.5">Net Payout</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                      No transactions found for this period.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-3.5 font-mono text-cyan-400">{tx.invoiceNumber || '—'}</td>
                      <td className="px-6 py-3.5 text-white">{tx.garageName}</td>
                      <td className="px-6 py-3.5 font-bold text-white">₹{parseFloat(tx.grossAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 text-amber-400">₹{parseFloat(tx.platformCommission || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-bold text-cyan-300">₹{parseFloat(tx.finalNetAmount || tx.garageNetAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === 'SETTLED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-400 text-[11px]">
                        {new Date(tx.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: TRENDS */}
      {activeTab === 'TRENDS' && summary?.trendData && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-4">
          <h2 className="text-sm font-bold text-white">Daily GMV & Commission Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Gross Volume (GMV)</th>
                  <th className="px-6 py-3.5">Platform Commission</th>
                  <th className="px-6 py-3.5">Garage Net</th>
                  <th className="px-6 py-3.5">Refunds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {summary.trendData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                      No daily trend entries in this period.
                    </td>
                  </tr>
                ) : (
                  summary.trendData.map((d, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-3.5 font-semibold text-white">{d.date}</td>
                      <td className="px-6 py-3.5 font-bold text-white">₹{d.gmv.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-bold text-cyan-400">₹{d.commission.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 text-emerald-400">₹{d.net.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 text-red-400">₹{d.refunds.toLocaleString('en-IN')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
