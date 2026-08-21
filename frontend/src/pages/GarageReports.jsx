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
  FileText,
  Building2,
  CheckCircle2,
  Clock,
  Printer,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../utils/api';
import { useToast } from '../context/ToastContext';

export default function GarageReports() {
  const { showSuccess, showError } = useToast();
  const [period, setPeriod] = useState('30_DAYS');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [summary, setSummary] = useState(null);
  const [statement, setStatement] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statementView, setStatementView] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Pagination for transactions
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = { period };
      if (period === 'CUSTOM') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }

      // Fetch summary
      const sumRes = await axios.get(`${API_BASE_URL}/garage/reports/summary`, { params, headers: getAuthHeaders() });
      if (sumRes.data?.success) {
        setSummary(sumRes.data.summary);
      }

      // Fetch transactions
      const txRes = await axios.get(`${API_BASE_URL}/garage/reports/transactions`, { params: { ...params, page, limit: 15 }, headers: getAuthHeaders() });
      if (txRes.data?.success) {
        setTransactions(txRes.data.transactions || []);
        setTotalPages(txRes.data.totalPages || 1);
        setTotalCount(txRes.data.totalCount || 0);
      }
    } catch (err) {
      showError('Failed to load garage reports');
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerateStatement = async () => {
    try {
      const params = { period };
      if (period === 'CUSTOM') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }
      const res = await axios.get(`${API_BASE_URL}/garage/reports/statement`, { params, headers: getAuthHeaders() });
      if (res.data?.success) {
        setStatement(res.data.statement);
        setStatementView(true);
      }
    } catch (err) {
      showError('Error generating statement');
    }
  };

  const handleExport = async (format = 'csv') => {
    setIsExporting(true);
    try {
      const params = { period, format, reportType: 'TRANSACTIONS' };
      if (period === 'CUSTOM') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }

      const res = await axios.get(`${API_BASE_URL}/garage/reports/export`, {
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
      a.download = `Garage_Report_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showSuccess(`Exported ${format.toUpperCase()} report successfully`);
    } catch (err) {
      showError('Failed to export financial report');
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Financial Reports & Statements</h1>
              <p className="text-xs text-slate-400">Authoritative server-side earnings ledgers, period statements and exports</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-950/80 border border-emerald-800 hover:border-emerald-700 rounded-xl text-xs font-bold text-emerald-300 hover:text-emerald-200 transition shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Export Excel (XLSX)
          </button>
          <button
            onClick={handleGenerateStatement}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-900 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            View Statement
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-300">Report Period:</span>
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
              onClick={() => { setPeriod(p.id); setPage(1); }}
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

      {/* Financial KPI Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gross Revenue</span>
            <span className="text-xl font-black text-white">₹{parseFloat(summary.grossRevenue || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">{summary.paidInvoiceCount} Paid Invoices</span>
          </div>

          <div className="bg-slate-900/60 border border-amber-900/30 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Platform Fees</span>
            <span className="text-xl font-black text-amber-400">₹{parseFloat(summary.platformCommission || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">Platform Commission</span>
          </div>

          <div className="bg-slate-900/60 border border-cyan-900/30 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">Net Earnings</span>
            <span className="text-xl font-black text-cyan-400">₹{parseFloat(summary.garageNetRevenue || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">Net of Platform Fee</span>
          </div>

          <div className="bg-slate-900/60 border border-red-900/30 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider block mb-1">Refund Deductions</span>
            <span className="text-xl font-black text-red-400">₹{parseFloat(summary.refundAmount || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">{summary.refundCount} Refunded</span>
          </div>

          <div className="bg-slate-900/60 border border-emerald-900/30 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Settled Payouts</span>
            <span className="text-xl font-black text-emerald-400">₹{parseFloat(summary.settledAmount || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-500 block mt-1">Completed Bank Transfers</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Available Balance</span>
            <span className="text-xl font-black text-white">₹{parseFloat(summary.availableBalance || 0).toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-cyan-400 block mt-1">Ready for Withdrawal</span>
          </div>
        </div>
      )}

      {/* Printable Statement Modal/View */}
      {statementView && statement && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">DrivePortz Official Financial Statement</span>
                <h2 className="text-xl font-black text-white mt-0.5">{statement.statementId}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  onClick={() => setStatementView(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Garage Info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block">Service Partner</span>
                <strong className="text-white text-sm">{statement.garage.name}</strong>
                <p className="text-slate-500 mt-1">{statement.garage.address}</p>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block">Statement Period</span>
                <strong className="text-white text-sm">{statement.period}</strong>
                <p className="text-slate-500 mt-1">Generated: {new Date(statement.generatedAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Statement Summary Breakdown */}
            <div className="border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-800/80">
                  <tr className="bg-slate-950/40">
                    <td className="px-4 py-3 text-slate-400">Total Period Gross Volume (GMV)</td>
                    <td className="px-4 py-3 text-right font-bold text-white">₹{statement.summary.grossRevenue.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-400">Less: Platform Service Fee (Commission)</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-400">- ₹{statement.summary.platformCommission.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-400">Less: Refund Adjustments</td>
                    <td className="px-4 py-3 text-right font-bold text-red-400">- ₹{statement.summary.refundAmount.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="bg-cyan-950/20 border-t border-cyan-800/40">
                    <td className="px-4 py-3 font-bold text-cyan-300">Net Partner Earnings</td>
                    <td className="px-4 py-3 text-right font-black text-cyan-300 text-sm">₹{statement.summary.garageNetRevenue.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-400">Less: Completed Settlement Payouts</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">- ₹{statement.summary.settledAmount.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="bg-slate-950 font-bold border-t border-slate-800">
                    <td className="px-4 py-3 text-white">Closing Available Withdrawal Balance</td>
                    <td className="px-4 py-3 text-right font-black text-white text-sm">₹{statement.summary.availableBalance.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              This statement is system-generated and mathematically verified by DrivePortz Financial Core.
            </p>
          </div>
        </div>
      )}

      {/* Transactions Breakdown Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Period Transactions Breakdown</h2>
          <span className="text-xs text-slate-400">{totalCount} Total Recorded Transactions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Invoice #</th>
                <th className="px-6 py-3.5">Vehicle</th>
                <th className="px-6 py-3.5">Gross</th>
                <th className="px-6 py-3.5">Platform Fee</th>
                <th className="px-6 py-3.5">Net Earnings</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading transaction reports...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    No transactions found for the selected period.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3.5 font-mono text-cyan-400 font-semibold">{tx.invoiceNumber || '—'}</td>
                    <td className="px-6 py-3.5 text-white">{tx.vehicleNumber || '—'}</td>
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

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, totalCount)} of {totalCount} transactions
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
