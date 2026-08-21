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
      const sumRes = await axios.get(`${API_BASE_URL}/api/garage/reports/summary`, { params, headers: getAuthHeaders() });
      if (sumRes.data?.success) {
        setSummary(sumRes.data.summary);
      }

      // Fetch transactions
      const txRes = await axios.get(`${API_BASE_URL}/api/garage/reports/transactions`, { params: { ...params, page, limit: 15 }, headers: getAuthHeaders() });
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
      const res = await axios.get(`${API_BASE_URL}/api/garage/reports/statement`, { params, headers: getAuthHeaders() });
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

      const res = await axios.get(`${API_BASE_URL}/api/garage/reports/export`, {
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
    <div className="min-h-screen bg-slate-50/50 text-slate-800 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 font-bold shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">Financial Reports & Statements</h1>
                <p className="text-xs text-slate-500">Authoritative server-side earnings ledgers, period statements and exports</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition shadow-xs disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export CSV
            </button>
            <button
              onClick={() => handleExport('xlsx')}
              disabled={isExporting}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold text-emerald-700 transition shadow-xs disabled:opacity-60"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Excel (XLSX)
            </button>
            <button
              onClick={handleGenerateStatement}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" />
              View Statement
            </button>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold text-slate-700">Report Period:</span>
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
                    ? 'bg-teal-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent'
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
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
              />
            </div>
          )}
        </div>

        {/* Financial KPI Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Gross Revenue</span>
              <span className="text-xl font-black text-slate-900 font-mono">₹{parseFloat(summary.grossRevenue || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-500 block mt-1">{summary.paidInvoiceCount} Paid Invoices</span>
            </div>

            <div className="bg-white border border-amber-200/70 p-4 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block mb-1">Platform Fees</span>
              <span className="text-xl font-black text-amber-600 font-mono">₹{parseFloat(summary.platformCommission || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Platform Commission</span>
            </div>

            <div className="bg-white border border-teal-200/70 p-4 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider block mb-1">Net Earnings</span>
              <span className="text-xl font-black text-teal-600 font-mono">₹{parseFloat(summary.garageNetRevenue || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Net of Platform Fee</span>
            </div>

            <div className="bg-white border border-rose-200/70 p-4 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block mb-1">Refund Deductions</span>
              <span className="text-xl font-black text-rose-600 font-mono">₹{parseFloat(summary.refundAmount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-500 block mt-1">{summary.refundCount} Refunded</span>
            </div>

            <div className="bg-white border border-emerald-200/70 p-4 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">Settled Payouts</span>
              <span className="text-xl font-black text-emerald-600 font-mono">₹{parseFloat(summary.settledAmount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Completed Bank Transfers</span>
            </div>

            <div className="bg-white border border-teal-200 p-4 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider block mb-1">Available Balance</span>
              <span className="text-xl font-black text-teal-700 font-mono">₹{parseFloat(summary.availableBalance || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-teal-600 font-medium block mt-1">Ready for Withdrawal</span>
            </div>
          </div>
        )}

        {/* Printable Statement Modal/View */}
        {statementView && statement && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">DrivePortz Official Financial Statement</span>
                  <h2 className="text-xl font-black text-slate-900 mt-0.5">{statement.statementId}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                  <button
                    onClick={() => setStatementView(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-semibold transition"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Garage Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Service Partner</span>
                  <strong className="text-slate-900 text-sm">{statement.garage.name}</strong>
                  <p className="text-slate-500 mt-1">{statement.garage.address}</p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Statement Period</span>
                  <strong className="text-slate-900 text-sm">{statement.period}</strong>
                  <p className="text-slate-500 mt-1">Generated: {new Date(statement.generatedAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Statement Summary Breakdown */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 font-medium">Total Period Gross Volume (GMV)</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">₹{statement.summary.grossRevenue.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-600">Less: Platform Service Fee (Commission)</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600 font-mono">- ₹{statement.summary.platformCommission.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-600">Less: Refund Adjustments</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600 font-mono">- ₹{statement.summary.refundAmount.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr className="bg-teal-50/70 border-t border-teal-200">
                      <td className="px-4 py-3 font-bold text-teal-800">Net Partner Earnings</td>
                      <td className="px-4 py-3 text-right font-black text-teal-700 text-sm font-mono">₹{statement.summary.garageNetRevenue.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-slate-600">Less: Completed Settlement Payouts</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 font-mono">- ₹{statement.summary.settledAmount.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold border-t border-slate-200">
                      <td className="px-4 py-3 text-slate-900">Closing Available Withdrawal Balance</td>
                      <td className="px-4 py-3 text-right font-black text-teal-800 text-sm font-mono">₹{statement.summary.availableBalance.toLocaleString('en-IN')}</td>
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
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Period Transactions Breakdown</h2>
            <span className="text-xs text-slate-500">{totalCount} Total Recorded Transactions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                      Loading transaction reports...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                      No transactions found for the selected period.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-3.5 font-mono text-teal-700 font-semibold">{tx.invoiceNumber || '—'}</td>
                      <td className="px-6 py-3.5 text-slate-900 font-medium">{tx.vehicleNumber || '—'}</td>
                      <td className="px-6 py-3.5 font-bold text-slate-900 font-mono">₹{parseFloat(tx.grossAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 text-amber-600 font-mono">₹{parseFloat(tx.platformCommission || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-bold text-teal-700 font-mono">₹{parseFloat(tx.finalNetAmount || tx.garageNetAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.status === 'SETTLED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-teal-50 text-teal-700 border border-teal-200'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right text-slate-500 text-[11px]">
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
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs text-slate-500">
                Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, totalCount)} of {totalCount} transactions
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition shadow-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-slate-700 px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition shadow-xs"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
