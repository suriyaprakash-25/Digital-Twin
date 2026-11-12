import { IndianRupee, CheckCircle2, BarChart3 } from 'lucide-react';

const whole = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const AmountCard = ({ label, labelClass, valueClass, iconClass, value, footer, footerClass }) => (
  <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
    <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${labelClass}`}>{label}</span>
    <div className={`text-xl sm:text-2xl font-black tracking-tight flex items-center ${valueClass}`}>
      <IndianRupee className={`h-4 w-4 mr-0.5 ${iconClass}`} aria-hidden="true" />
      {whole(value)}
    </div>
    <p className={`text-[10px] mt-1 ${footerClass}`}>{footer}</p>
  </div>
);

/** Six KPI cards for the garage payments page. */
export const RevenueSummaryCards = ({ summary }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
    <AmountCard
      label="Total Revenue" labelClass="text-slate-400" valueClass="text-slate-900" iconClass="text-slate-400"
      value={summary.totalRevenue}
      footerClass="font-bold text-emerald-600 flex items-center gap-0.5"
      footer={<><CheckCircle2 className="h-3 w-3" aria-hidden="true" />{summary.paidInvoices} Paid Bills</>}
    />
    <AmountCard
      label="Today's Revenue" labelClass="text-teal-600" valueClass="text-teal-700" iconClass="text-teal-500"
      value={summary.todayRevenue} footerClass="font-medium text-slate-400" footer="Settled today"
    />
    <AmountCard
      label="This Month" labelClass="text-slate-600" valueClass="text-slate-800" iconClass="text-slate-400"
      value={summary.monthRevenue} footerClass="font-medium text-slate-400" footer="Current Month"
    />
    <AmountCard
      label="Pending Amount" labelClass="text-amber-600" valueClass="text-amber-700" iconClass="text-amber-500"
      value={summary.pendingPayments} footerClass="font-medium text-amber-600" footer="Awaiting Payment"
    />
    <AmountCard
      label="Total Refunded" labelClass="text-violet-600" valueClass="text-violet-800" iconClass="text-violet-500"
      value={summary.refundedAmount} footerClass="font-medium text-violet-600" footer="Refunded to Customers"
    />
    <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Paid Invoices</span>
      <div className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
        {summary.paidInvoices} <span className="text-xs text-slate-400 font-normal">/ {summary.totalServicesLogged}</span>
      </div>
      <p className="text-[10px] font-medium text-slate-400 mt-1">Completed Services</p>
    </div>
  </div>
);

/** Simple bar chart of revenue per period bucket. */
export const RevenueTrends = ({ data, period, onPeriodChange }) => {
  if (!data.length) return null;
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-teal-600" aria-hidden="true" />
          <h3 className="text-sm font-extrabold text-slate-900">Revenue Trends</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {['7days', '30days'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              aria-pressed={period === p}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                period === p ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {p === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-36 flex items-end gap-2 pt-4 border-t border-slate-50">
        {data.map((d, i) => {
          const heightPercent = Math.max(8, (d.revenue / maxRevenue) * 100);
          const label = `₹${Number(d.revenue || 0).toLocaleString('en-IN')} (${d.count} sales)`;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative" title={`${d.label}: ${label}`}>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                {label}
              </div>
              <div style={{ height: `${heightPercent}%` }} className="w-full bg-teal-500 hover:bg-teal-600 rounded-t-lg transition-all" />
              <span className="text-[9px] font-bold text-slate-400 truncate max-w-full">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
