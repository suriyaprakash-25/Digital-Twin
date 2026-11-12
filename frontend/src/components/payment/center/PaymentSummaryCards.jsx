import { CheckCircle2, Clock, RefreshCw, FileText } from 'lucide-react';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const SummaryCard = ({ label, value, valueClass, icon, iconClass, footnote }) => {
  const Icon = icon;
  return (
  <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm relative overflow-hidden">
    <div className="flex justify-between items-start">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <p className={`font-metric text-metric-lg mt-1 ${valueClass}`}>{value}</p>
      </div>
      <div className={`p-2 border rounded-xl ${iconClass}`}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
    </div>
    <p className="text-xs text-slate-500 mt-3">{footnote}</p>
  </div>
  );
};

/** KPI row at the top of the customer Payment Center. */
const PaymentSummaryCards = ({ summary }) => {
  const dist = summary?.statusDistribution || {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard
        label="Total Paid"
        value={money(summary?.totalPaidAmount)}
        valueClass="text-slate-900"
        icon={CheckCircle2}
        iconClass="bg-emerald-50 border-emerald-200 text-emerald-600"
        footnote={`${dist.CAPTURED || 0} Successful Transactions`}
      />
      <SummaryCard
        label="Pending Payments"
        value={money(summary?.pendingAmount)}
        valueClass="text-amber-600"
        icon={Clock}
        iconClass="bg-amber-50 border-amber-200 text-amber-600"
        footnote={`${dist.PENDING || 0} Invoices Awaiting Settlement`}
      />
      <SummaryCard
        label="Refunds Received"
        value={money(summary?.refundAmount)}
        valueClass="text-sky-600"
        icon={RefreshCw}
        iconClass="bg-sky-50 border-sky-200 text-sky-600"
        footnote={`${(dist.REFUNDED || 0) + (dist.PARTIALLY_REFUNDED || 0)} Credited Adjustments`}
      />
      <SummaryCard
        label="Tax Invoices"
        value={summary?.invoicesCount || 0}
        valueClass="text-teal-600"
        icon={FileText}
        iconClass="bg-teal-50 border-teal-200 text-teal-600"
        footnote={`Across ${summary?.vehicles?.length || 0} Registered Vehicles`}
      />
    </div>
  );
};

export default PaymentSummaryCards;
