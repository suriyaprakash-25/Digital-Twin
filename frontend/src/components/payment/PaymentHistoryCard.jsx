import { Link } from 'react-router-dom';
import { AlertTriangle, Building, Car, Eye, FileText, IndianRupee, Receipt, RefreshCw } from 'lucide-react';
import { PaymentStatusBadge } from '../common/StatusBadge';

/** One transaction in the owner's payment history list. */
const PaymentHistoryCard = ({ payment: p, onDetails, onInvoice, onReceipt, onDispute }) => {
  const isSuccess = p.status === 'CAPTURED' || p.status === 'PAID';
  const isFailed = p.status === 'FAILED';
  const isRefunded = p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED';

  return (
    <li
      className="bg-white border border-slate-100 hover:border-teal-200 rounded-2xl p-5 md:p-6 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      {/* Left info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <PaymentStatusBadge status={p.status} refundedAmount={p.totalRefundedAmount} uppercase />

          {p.invoiceNumber && (
            <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
              {p.invoiceNumber}
            </span>
          )}

          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-100 flex items-center gap-1">
            <Car className="h-3 w-3" aria-hidden="true" />
            {p.vehicleNumber}
          </span>

          <span className="text-xs font-semibold text-slate-400">
            {p.date
              ? new Date(p.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : '—'}
          </span>
        </div>

        <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">
          {p.serviceType}
        </h2>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-500 flex-wrap">
          <span className="flex items-center gap-1">
            <Building className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {p.garageName}
          </span>
          {p.paymentId && p.paymentId !== '—' && (
            <span className="font-mono text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
              ID: {p.paymentId}
            </span>
          )}
          {p.paymentMethod && (
            <span className="text-slate-400">
              Method: <strong className="text-slate-600">{p.paymentMethod}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Right amount and actions */}
      <div className="flex flex-col md:items-end gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
        <div className="text-left md:text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
            Amount
          </span>
          <span className="text-lg md:text-2xl font-black text-slate-900 flex items-center tracking-tight md:justify-end">
            <IndianRupee className="h-4 w-4 md:h-5 md:w-5 mr-0.5 text-slate-400" aria-hidden="true" />
            {Number(p.amount || 0).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onDetails(p)}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Details
          </button>

          {p.serviceId && (
            <button
              type="button"
              onClick={() => onInvoice(p.serviceId)}
              className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              Invoice
            </button>
          )}

          {(isSuccess || isRefunded) && p.serviceId && (
            <button
              type="button"
              onClick={() => onReceipt(p.serviceId)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
            >
              <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
              Receipt
            </button>
          )}

          {isSuccess && (
            <button
              type="button"
              onClick={() => onDispute(p)}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Raise Dispute
            </button>
          )}

          {isFailed && p.vehicleId && (
            <Link
              to={`/service-history/${p.vehicleId}`}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry Payment
            </Link>
          )}
        </div>
      </div>
    </li>
  );
};

export default PaymentHistoryCard;
