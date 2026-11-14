import { useState, useEffect, useCallback } from 'react';
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
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiGet, apiRequest, getErrorMessage } from '../utils/api';
import ErrorState from '../components/common/ErrorState';
import GarageStatementModal from '../components/garage/GarageStatementModal';
import { useToast } from '../context/toastContextCore';

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

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
      const sumData = await apiGet('/garage/reports/summary', params);
      if (sumData?.success) {
        setSummary(sumData.summary);
      }

      // Fetch transactions
      const txData = await apiGet('/garage/reports/transactions', { ...params, page, limit: 15 });
      if (txData?.success) {
        setTransactions(txData.transactions || []);
        setTotalPages(txData.totalPages || 1);
        setTotalCount(txData.totalCount || 0);
      }
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load garage reports'));
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo, page]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) fetchReports(); });
    return () => { cancelled = true; };
  }, [fetchReports]);

  const handleGenerateStatement = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const params = { period };
      if (period === 'CUSTOM') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }
      const data = await apiGet('/garage/reports/statement', params);
      if (data?.success) {
        setStatement(data.statement);
        setStatementView(true);
      }
    } catch (err) {
      showError(getErrorMessage(err, 'Error generating statement'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async (format = 'csv') => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const params = { period, format, reportType: 'TRANSACTIONS' };
      if (period === 'CUSTOM') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }

      const { data } = await apiRequest({
        method: 'get',
        url: '/garage/reports/export',
        params,
        responseType: 'blob'
      });

      const blob = new Blob([data], {
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
      showError(getErrorMessage(err, 'Failed to export financial report'));
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
              type="button"
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition shadow-xs disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              disabled={isExporting}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold text-emerald-700 transition shadow-xs disabled:opacity-60"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export Excel (XLSX)
            </button>
            <button
              type="button"
              onClick={handleGenerateStatement}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-60"
            >
              {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <FileText className="w-3.5 h-3.5" />}
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
                type="button"
                aria-pressed={period === p.id}
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
                aria-label="From date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                aria-label="To date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-teal-500"
              />
            </div>
          )}
        </div>

        {error && <ErrorState message={error} onRetry={fetchReports} retrying={loading} />}

        {/* Financial KPI Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Gross Revenue</span>
              <span className="font-metric text-metric-lg text-slate-900">₹{parseFloat(summary.grossRevenue || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-500 block mt-1">{summary.paidInvoiceCount} Paid Invoices</span>
            </div>


            <div className="bg-white border border-teal-200/70 p-4 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider block mb-1">Net Earnings</span>
              <span className="font-metric text-metric-lg text-teal-600">₹{parseFloat(summary.garageNetRevenue || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Net Revenue</span>
            </div>

            <div className="bg-white border border-rose-200/70 p-4 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block mb-1">Refund Deductions</span>
              <span className="font-metric text-metric-lg text-rose-600">₹{parseFloat(summary.refundAmount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-500 block mt-1">{summary.refundCount} Refunded</span>
            </div>

            <div className="bg-white border border-emerald-200/70 p-4 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">Settled Payouts</span>
              <span className="font-metric text-metric-lg text-emerald-600">₹{parseFloat(summary.settledAmount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Completed Bank Transfers</span>
            </div>

            <div className="bg-white border border-teal-200 p-4 rounded-2xl shadow-sm">
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider block mb-1">Available Balance</span>
              <span className="font-metric text-metric-lg text-teal-700">₹{parseFloat(summary.availableBalance || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-teal-600 font-medium block mt-1">Ready for Withdrawal</span>
            </div>
          </div>
        )}

        {/* Printable Statement Modal/View */}
        {statementView && statement && (
          <GarageStatementModal statement={statement} onClose={() => setStatementView(false)} />
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
                  type="button"
                  aria-label="Previous page"
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
                  type="button"
                  aria-label="Next page"
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
