import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
import { apiGet, getErrorMessage } from '../../utils/api';
import ErrorState from '../../components/common/ErrorState';

export default function AdminFinancialOperationsDashboard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [health, setHealth] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [integritySummary, setIntegritySummary] = useState(null);
  const [taxSummary, setTaxSummary] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [hData, fData, aData, iData, tData] = await Promise.all([
        apiGet('/health'),
        apiGet('/admin/treasury/forecast'),
        apiGet('/admin/alerts/summary'),
        apiGet('/admin/financial-integrity/summary'),
        apiGet('/admin/tax/summary?period=TODAY')
      ]);

      if (hData) setHealth(hData);
      if (fData?.success) setForecast(fData.forecast);
      if (aData?.success) setAlertsSummary(aData.summary);
      if (iData?.success) setIntegritySummary(iData.summary);
      if (tData?.success) setTaxSummary(tData.summary);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load command center operations data'));
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
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-slate-900 font-bold shadow-lg shadow-cyan-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Financial Operations Command Center</h1>
              <p className="text-xs text-slate-500">Holistic financial health, treasury forecast, alerts, integrity checks, and system subsystems</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh Status
        </button>
      </div>

      {loadError && <ErrorState message={loadError} onRetry={fetchDashboardData} retrying={loading} />}

      {/* System Subsystems Live Status Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Subsystem Health:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-500">Database:</span>
            <span className="font-bold text-emerald-400 uppercase">{health?.services?.database || 'Healthy'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span className="text-slate-500">Payment Gateway:</span>
            <span className="font-bold text-blue-400 uppercase">{health?.services?.cashfree || health?.services?.paymentGateway || health?.services?.razorpay || 'Configured'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            <span className="text-slate-500">Settlement Provider:</span>
            <span className="font-bold text-purple-400 uppercase">{health?.services?.settlement || 'Mock'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="text-slate-500">Schedulers:</span>
            <span className="font-bold text-cyan-400 uppercase">{health?.services?.scheduler || 'Active'}</span>
          </div>
        </div>
      </div>

      {/* 6 Key Financial Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-emerald-100 bg-emerald-50/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Available Balance</span>
          <span className="text-xl font-black text-slate-900">₹{((forecast?.currentAvailableBalance || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Ready for Payout</span>
        </div>

        <div className="bg-white border border-cyan-100 bg-cyan-50/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">Pending Settlements</span>
          <span className="text-xl font-black text-cyan-400">₹{((forecast?.pendingSettlementAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">In Processing Queue</span>
        </div>

        <div className="bg-white border border-indigo-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">7-Day Forecast</span>
          <span className="text-xl font-black text-indigo-400">₹{((forecast?.projected7DayPayout || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Projected Payouts</span>
        </div>

        <div className="bg-white border border-rose-900/40 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-1">Financial Alerts</span>
          <span className="text-xl font-black text-rose-400">{alertsSummary?.openAlerts || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">{alertsSummary?.criticalAlerts || 0} Critical</span>
        </div>

        <div className="bg-white border border-amber-100 bg-amber-50/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">Integrity Issues</span>
          <span className="text-xl font-black text-amber-400">{integritySummary?.openIssues || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Discrepancies</span>
        </div>

        <div className="bg-white border border-purple-100 bg-purple-50/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">Today Tax Liability</span>
          <span className="text-xl font-black text-purple-400">₹{((taxSummary?.netTaxLiabilityAmount || 0)).toLocaleString('en-IN')}</span>
          <span className="text-[10px] text-slate-500 block mt-1">{taxSummary?.invoiceCount || 0} Invoices</span>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-600">Operational Subsystems</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className="group p-5 bg-white border border-slate-200 hover:border-slate-200 rounded-2xl transition hover:-translate-y-0.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-slate-700 flex items-center justify-center text-cyan-400 transition">
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-slate-900 transition" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-cyan-400 transition">{link.title}</h3>
                  <p className="text-[11px] text-slate-500 mt-1">{link.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}
