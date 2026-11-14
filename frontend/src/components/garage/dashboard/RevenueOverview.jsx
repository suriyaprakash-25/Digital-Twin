import { Link } from 'react-router-dom';
import { CreditCard, ArrowRight, IndianRupee, CheckCircle2 } from 'lucide-react';

const amount = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const RevenueOverview = ({ revenueSummary }) => (
  <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
      <div>
        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span className="p-1.5 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
            <CreditCard className="h-4 w-4" />
          </span>
          Revenue & Invoicing Center
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Verified customer payments and finalized service billing overview
        </p>
      </div>

      <Link
        to="/garage/payments"
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs self-start sm:self-auto"
      >
        <span>Manage Invoices & Payments</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Revenue</span>
        <div className="font-metric text-metric-lg text-slate-900 flex items-center">
          <IndianRupee className="h-5 w-5 text-slate-400 mr-0.5" />
          {amount(revenueSummary.totalRevenue)}
        </div>
        <span className="text-[11px] font-bold text-emerald-600 mt-1 inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> {revenueSummary.paidInvoices} paid invoices
        </span>
      </div>

      <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Today's Revenue</span>
        <div className="font-metric text-metric-lg text-teal-700 flex items-center">
          <IndianRupee className="h-5 w-5 text-teal-500 mr-0.5" />
          {amount(revenueSummary.todayRevenue)}
        </div>
        <span className="text-[11px] font-semibold text-slate-400 mt-1 block">Settled today</span>
      </div>

      <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Pending Payments</span>
        <div className="font-metric text-metric-lg text-amber-700 flex items-center">
          <IndianRupee className="h-5 w-5 text-amber-500 mr-0.5" />
          {amount(revenueSummary.pendingPayments)}
        </div>
        <span className="text-[11px] font-semibold text-slate-400 mt-1 block">Awaiting customer payment</span>
      </div>

      <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Paid Invoices</span>
        <div className="font-metric text-metric-lg text-slate-800">{revenueSummary.paidInvoices}</div>
        <span className="text-[11px] font-semibold text-slate-400 mt-1 block">Settled digitally via the payment gateway</span>
      </div>
    </div>
  </div>
);

export default RevenueOverview;
