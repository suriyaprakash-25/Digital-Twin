import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Activity,
  CreditCard,
  Percent,
  Receipt,
  Scale,
  FileText,
  FileCheck2,
  ShieldAlert,
  BellRing,
  AlertTriangle,
  Landmark,
  TrendingUp,
  RefreshCw,
  Server,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  ChevronRight
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

export default function AdminFinancialOperationsDashboard() {
  const { showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [integritySummary, setIntegritySummary] = useState(null);
  const [taxSummary, setTaxSummary] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [hRes, fRes, aRes, iRes, tRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/health`, { headers: getAuthHeaders() }),
        axios.get(`${API_BASE_URL}/admin/treasury/forecast`, { headers: getAuthHeaders() }),
        axios.get(`${API_BASE_URL}/admin/alerts/summary`, { headers: getAuthHeaders() }),
        axios.get(`${API_BASE_URL}/admin/financial-integrity/summary`, { headers: getAuthHeaders() }),
        axios.get(`${API_BASE_URL}/admin/tax/summary?period=TODAY`, { headers: getAuthHeaders() })
      ]);

      if (hRes.data) setHealth(hRes.data);
      if (fRes.data?.success) setForecast(fRes.data.forecast);
      if (aRes.data?.success) setAlertsSummary(aRes.data.summary);
      if (iRes.data?.success) setIntegritySummary(iRes.data.summary);
      if (tRes.data?.success) setTaxSummary(tRes.data.summary);
    } catch (err) {
      showError('Failed to load command center operations data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const quickLinks = [
    { title: 'Payment Center', path: '/admin/payments', icon: CreditCard, color: 'emerald', desc: 'Standard checkout transactions & verification' },
    { title: 'Settlement Intelligence', path: '/admin/settlements', icon: Receipt, color: 'cyan', desc: 'Automated settlement engine & payouts' },
    { title: 'Treasury & Liquidity', path: '/admin/treasury', icon: Landmark, color: 'blue', desc: '7d/30d forecasting & aging buckets' },
    { title: 'Financial Operations', path: '/admin/financial-operations', icon: Scale, color: 'indigo', desc: 'Maker-checker & dual-approval governance' },
    { title: 'Tax & Compliance', path: '/admin/tax-compliance', icon: FileCheck2, color: 'amber', desc: 'GST breakdown & credit notes' },
    { title: 'Risk Cases & Fraud', path: '/admin/risk-cases', icon: ShieldAlert, color: 'red', desc: 'Multi-entity risk correlation desk' },
    { title: 'Financial Alerts', path: '/admin/financial-alerts', icon: BellRing, color: 'rose', desc: 'System anomaly alerts & SLA monitors' },
    { title: 'Financial Audit Trail', path: '/admin/financial-audit', icon: FileText, color: 'purple', desc: 'Append-only regulatory audit ledger' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Financial Operations Command Center</h1>
              <p className="text-xs text-slate-400">Holistic financial health, treasury forecast, alerts, integrity checks, and system subsystems</p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Status
        </button>
      </div>

      {/* System Subsystems Live Status Bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Subsystem Health:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400">Database:</span>
            <span className="font-bold text-emerald-400 uppercase">{health?.services?.database || 'Healthy'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span className="text-slate-400">Razorpay:</span>
            <span className="font-bold text-blue-400 uppercase">{health?.services?.razorpay || 'Configured'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            <span className="text-slate-400">Settlement Provider:</span>
            <span className="font-bold text-purple-400 uppercase">{health?.services?.settlement || 'Mock'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="text-slate-400">Schedulers:</span>
            <span className="font-bold text-cyan-400 uppercase">{health?.services?.scheduler || 'Active'}</span>
          </div>
        </div>
      </div>

      {/* 6 Key Financial Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-900/60 border border-emerald-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Available Balance</span>
          <span className="text-xl font-black text-white">₹{((forecast?.currentAvailableBalance || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Ready for Payout</span>
        </div>

        <div className="bg-slate-900/60 border border-cyan-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">Pending Settlements</span>
          <span className="text-xl font-black text-cyan-400">₹{((forecast?.pendingSettlementAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">In Processing Queue</span>
        </div>

        <div className="bg-slate-900/60 border border-indigo-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">7-Day Forecast</span>
          <span className="text-xl font-black text-indigo-400">₹{((forecast?.projected7DayPayout || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Projected Payouts</span>
        </div>

        <div className="bg-slate-900/60 border border-rose-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-1">Financial Alerts</span>
          <span className="text-xl font-black text-rose-400">{alertsSummary?.openAlerts || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">{alertsSummary?.criticalAlerts || 0} Critical</span>
        </div>

        <div className="bg-slate-900/60 border border-amber-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Integrity Issues</span>
          <span className="text-xl font-black text-amber-400">{integritySummary?.openIssues || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Discrepancies</span>
        </div>

        <div className="bg-slate-900/60 border border-purple-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">Today Tax Liability</span>
          <span className="text-xl font-black text-purple-400">₹{((taxSummary?.netTaxLiabilityAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">{taxSummary?.invoiceCount || 0} Invoices</span>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-300">Operational Subsystems</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className="group p-5 bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl transition hover:-translate-y-0.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 group-hover:bg-slate-700 flex items-center justify-center text-cyan-400 transition">
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition">{link.title}</h3>
                  <p className="text-[11px] text-slate-400 mt-1">{link.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}
