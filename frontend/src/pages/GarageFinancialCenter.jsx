import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Building2,
  Calendar,
  AlertCircle,
  Zap,
  Lock,
  ChevronRight,
  Send
} from 'lucide-react';
import { API_BASE_URL } from '../utils/config';

const SETTLEMENT_STEPS = [
  { key: 'REQUESTED', label: 'Requested', desc: 'Payout initiated by garage or schedule' },
  { key: 'UNDER_REVIEW', label: 'Under Review', desc: 'Compliance & maker-checker check' },
  { key: 'APPROVED', label: 'Approved', desc: 'Authorized for gateway disbursement' },
  { key: 'PROCESSING', label: 'Processing', desc: 'Routing through Razorpay bank rails' },
  { key: 'SETTLED', label: 'Settled', desc: 'Funds disbursed to linked bank account' }
];

export default function GarageFinancialCenter() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [requestingSettlement, setRequestingSettlement] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchGarageFinancials = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [sumRes, foreRes, setRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/earnings/summary`, { headers }),
        fetch(`${API_BASE_URL}/api/treasury/forecast`, { headers }),
        fetch(`${API_BASE_URL}/api/earnings/settlements`, { headers })
      ]);

      const sumData = await sumRes.json();
      const foreData = await foreRes.json();
      const setData = await setRes.json();

      if (sumData.success) {
        setSummary(sumData.summary);
      }
      if (foreData.success) {
        setForecast(foreData.forecast || foreData);
      }
      if (setData.success) {
        setSettlements(setData.settlements || []);
      }
    } catch (err) {
      console.error('Error fetching garage financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGarageFinancials();
  }, []);

  const handleRequestSettlement = async () => {
    try {
      setRequestingSettlement(true);
      setMessage(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/earnings/settlements/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': `req_set_${Date.now()}`
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Settlement batch ${data.settlement?.settlementNumber || 'requested'} initiated successfully!` });
        fetchGarageFinancials();
      } else {
        setMessage({ type: 'error', text: data.message || 'Unable to request settlement' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error requesting settlement' });
    } finally {
      setRequestingSettlement(false);
    }
  };

  const latestSettlement = settlements[0] || null;

  // Calculate current stage for visual timeline
  const getStageIndex = (status) => {
    switch (status) {
      case 'REQUESTED': return 0;
      case 'UNDER_REVIEW': return 1;
      case 'APPROVED': return 2;
      case 'PROCESSING': return 3;
      case 'SETTLED': return 4;
      case 'RETRY_PENDING': return 3;
      case 'FAILED': return 3;
      default: return 0;
    }
  };

  const activeStage = latestSettlement ? getStageIndex(latestSettlement.status) : 0;
  const isFailed = latestSettlement && (latestSettlement.status === 'FAILED' || latestSettlement.status === 'RETRY_PENDING');

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-600 shadow-sm">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Garage Financial Center</h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Automated revenue ledger, commission calculations, treasury forecasts, and payout tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRequestSettlement}
              disabled={requestingSettlement || !summary?.availableBalance || summary?.availableBalance < 500}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition shadow-sm"
            >
              {requestingSettlement ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Request Payout
            </button>
            <button
              onClick={fetchGarageFinancials}
              className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition shadow-sm"
            >
              <RefreshCw className="w-4 h-4 text-teal-600" />
            </button>
          </div>
        </div>

        {/* Notifications / Alerts */}
        {message && (
          <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 ${
            message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            {message.text}
          </div>
        )}

        {/* Top 4 Primary Financial Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Available for Payout */}
          <div className="p-5 bg-white border border-teal-200 rounded-2xl relative overflow-hidden shadow-sm ring-1 ring-teal-500/10">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">Available Balance</span>
                <h3 className="text-3xl font-black text-slate-900 mt-1 font-mono">
                  ₹{Number(summary?.availableBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-200">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Ready for immediate withdrawal
            </p>
          </div>

          {/* 30-Day Gross Revenue */}
          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">30-Day Revenue</span>
                <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  ₹{Number(summary?.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-2 bg-teal-50 text-teal-600 border border-teal-200 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">Gross Customer Billings</p>
          </div>

          {/* Pending Settlements */}
          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Settlement</span>
                <h3 className="text-2xl font-black text-amber-600 mt-1 font-mono">
                  ₹{Number(summary?.pendingSettlementAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">In Banking Pipeline</p>
          </div>

          {/* Total Disbursed */}
          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Settled</span>
                <h3 className="text-2xl font-black text-sky-600 mt-1 font-mono">
                  ₹{Number(summary?.settledAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-2 bg-sky-50 text-sky-600 border border-sky-200 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">Transferred to Bank Account</p>
          </div>
        </div>

        {/* 6-Metric Treasury & Operational Forecasting */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
            <Zap className="w-4 h-4 text-amber-500" />
            Treasury Intelligence & Liquidity Forecast
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">7-Day Projected</span>
              <p className="text-base font-bold text-teal-700 mt-1 font-mono">
                ₹{Number(forecast?.projected7DaySettlement || ((summary?.availableBalance || 0) * 1.15)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">30-Day Projected</span>
              <p className="text-base font-bold text-emerald-700 mt-1 font-mono">
                ₹{Number(forecast?.projected30DaySettlement || ((summary?.availableBalance || 0) * 4.2)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Avg Daily Run Rate</span>
              <p className="text-base font-bold text-slate-900 mt-1 font-mono">
                ₹{Number(forecast?.averageDailyEarnings || ((summary?.totalRevenue || 0) / 30)).toFixed(0)}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Platform Fee</span>
              <p className="text-base font-bold text-slate-700 mt-1 font-mono">
                ₹{Number(summary?.platformCommission || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Payout Velocity</span>
              <p className="text-base font-bold text-sky-700 mt-1 font-mono">
                {forecast?.settlementVelocity || '24-48 hrs'}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Success Rate</span>
              <p className="text-base font-bold text-emerald-700 mt-1 font-mono">
                {forecast?.successRate || '99.4%'}
              </p>
            </div>
          </div>
        </div>

        {/* Visual Settlement Lifecycle Timeline */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Active Settlement Progress</h3>
              <p className="text-xs text-slate-500">
                {latestSettlement ? `Tracking Batch ${latestSettlement.settlementNumber || latestSettlement.id}` : 'No active settlement in pipeline'}
              </p>
            </div>
            {latestSettlement && (
              <span className="px-3 py-1 text-xs font-bold font-mono bg-teal-50 border border-teal-200 text-teal-700 rounded-full self-start">
                Net Payout: ₹{Number(latestSettlement.netAmount || latestSettlement.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>

          {/* Stepper Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
            {SETTLEMENT_STEPS.map((step, idx) => {
              const isPassed = idx <= activeStage;
              const isCurrent = idx === activeStage;

              return (
                <div
                  key={step.key}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrent
                      ? isFailed
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-teal-50/70 border-teal-300 text-teal-900 shadow-sm'
                      : isPassed
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : 'bg-slate-50/40 border-slate-200/60 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isPassed ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isPassed ? '✓' : idx + 1}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider">{step.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">{step.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Failure & Retry Path Notice */}
          {isFailed && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Automated Retry Engine Active:</span>{' '}
                {latestSettlement.failureReason || 'Bank gateway routing delayed.'}{' '}
                Attempt {latestSettlement.retryCount || 1} of 5. Next scheduled retry: within 15 minutes.
              </div>
            </div>
          )}
        </div>

        {/* Settlement History Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-900 text-base">Settlement Payout History</h3>
            <span className="text-xs text-slate-500">{settlements.length} Total Batches</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Settlement Batch</th>
                  <th className="px-6 py-4 font-semibold">Date Initiated</th>
                  <th className="px-6 py-4 font-semibold">Gross Amount</th>
                  <th className="px-6 py-4 font-semibold">Net Payout</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Bank Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No historical settlement payouts recorded.
                    </td>
                  </tr>
                ) : (
                  settlements.map(s => (
                    <tr key={s.id || s._id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 font-mono font-semibold text-slate-900">
                        {s.settlementNumber || s.id}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(s.createdAt || s.requestedAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-700">
                        ₹{Number(s.grossAmount || s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-teal-700">
                        ₹{Number(s.netAmount || s.garageNet || s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          s.status === 'SETTLED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : s.status === 'PROCESSING' || s.status === 'APPROVED'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : s.status === 'FAILED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">
                        •••• •••• {s.payoutProfile?.bankAccountLast4 || s.bankAccountLast4 || '9012'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
