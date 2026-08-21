import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FileCheck2,
  Calendar,
  Download,
  Percent,
  Search,
  Filter,
  RefreshCw,
  ArrowDownRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function AdminTaxCompliance() {
  const { showSuccess, showError } = useToast();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30_DAYS');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTaxData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        period,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: 20
      };

      const [sumRes, txRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/admin/tax/summary`, { params, headers: getAuthHeaders() }),
        axios.get(`${API_BASE_URL}/admin/tax/transactions`, { params, headers: getAuthHeaders() })
      ]);

      if (sumRes.data?.success) setSummary(sumRes.data.summary);
      if (txRes.data?.success) {
        setTransactions(txRes.data.transactions || []);
        setTotalPages(txRes.data.totalPages || 1);
        setTotalCount(txRes.data.totalCount || 0);
      }
    } catch (err) {
      showError('Failed to load tax compliance data');
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchTaxData();
  }, [fetchTaxData]);

  const handleExport = async (format) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/tax/export`, {
        params: { period, dateFrom, dateTo, format },
        responseType: 'blob',
        headers: getAuthHeaders()
      });

      const blob = new Blob([res.data]);
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `DrivePortz_TAX_REPORT_${new Date().toISOString().split('T')[0]}.${format}`;
      link.click();
      showSuccess(`Tax report ${format.toUpperCase()} export downloaded`);
    } catch (err) {
      showError('Export failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Tax Compliance & Regulatory Ledger</h1>
              <p className="text-xs text-slate-400">GST, CGST, SGST, IGST, credit notes, immutable snapshots, and authoritative tax reporting</p>
            </div>
          </div>
        </div>

        {/* Period Filter & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(e) => { setPeriod(e.target.value); setPage(1); }}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="TODAY">Today</option>
            <option value="7_DAYS">Last 7 Days</option>
            <option value="30_DAYS">Last 30 Days</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="THIS_YEAR">This Year</option>
          </select>

          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            <Download className="w-3.5 h-3.5" />
            XLSX
          </button>
        </div>
      </div>

      {/* 6 Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Taxable Volume</span>
          <span className="text-xl font-black text-white">₹{((summary?.taxableAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">{summary?.invoiceCount || 0} Invoices</span>
        </div>

        <div className="bg-slate-900/60 border border-blue-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider block mb-1">CGST (9%)</span>
          <span className="text-xl font-black text-blue-400">₹{((summary?.cgstAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Intrastate Central</span>
        </div>

        <div className="bg-slate-900/60 border border-cyan-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">SGST (9%)</span>
          <span className="text-xl font-black text-cyan-400">₹{((summary?.sgstAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Intrastate State</span>
        </div>

        <div className="bg-slate-900/60 border border-purple-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">IGST (18%)</span>
          <span className="text-xl font-black text-purple-400">₹{((summary?.igstAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Interstate Integrated</span>
        </div>

        <div className="bg-slate-900/60 border border-amber-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Credit Notes Tax</span>
          <span className="text-xl font-black text-amber-400">-₹{((summary?.creditNotesTaxAdjustmentAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">{summary?.creditNoteCount || 0} Credit Notes</span>
        </div>

        <div className="bg-slate-900/60 border border-emerald-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Net Tax Liability</span>
          <span className="text-xl font-black text-emerald-400">₹{((summary?.netTaxLiabilityAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Total Remittance</span>
        </div>
      </div>

      {/* Tax Invoices Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Invoice #</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Taxable Base</th>
                <th className="px-6 py-3.5">Tax Details</th>
                <th className="px-6 py-3.5">Total Tax</th>
                <th className="px-6 py-3.5">Grand Total</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                    Loading tax compliance records...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    No finalized tax invoices in this period.
                  </td>
                </tr>
              ) : (
                transactions.map((inv) => {
                  const gross = parseFloat(inv.grandTotal || inv.amount || 0);
                  const taxable = inv.taxSnapshot ? inv.taxSnapshot.taxableAmount : (gross / 1.18).toFixed(2);
                  const cgst = inv.taxSnapshot ? inv.taxSnapshot.cgstAmount : (gross * 0.09 / 1.18).toFixed(2);
                  const sgst = inv.taxSnapshot ? inv.taxSnapshot.sgstAmount : (gross * 0.09 / 1.18).toFixed(2);
                  const totalTax = inv.taxSnapshot ? inv.taxSnapshot.totalTaxAmount : (gross - parseFloat(taxable)).toFixed(2);

                  return (
                    <tr key={inv._id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-3.5 font-mono font-semibold text-amber-400">{inv.invoiceNumber}</td>
                      <td className="px-6 py-3.5 text-slate-400">
                        {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-white">₹{parseFloat(taxable).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 text-slate-400 text-[11px]">
                        CGST: ₹{cgst} | SGST: ₹{sgst}
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-amber-300">₹{parseFloat(totalTax).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5 font-bold text-white">₹{gross.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
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
