import { CreditCard, FileText, Car, Loader2, RefreshCw } from 'lucide-react';
import { PaymentStatusBadge } from '../../common/StatusBadge';
import { hasRefundActivity, isPayable } from './paymentFilterUtils';
import { formatDate } from '../../../utils/format';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/** Customer transactions table with invoice, refund-tracking and Pay Now actions. */
const PaymentTransactionsTable = ({ payments, loading, isPaying, payDisabled, onViewInvoice, onTrackRefund, onPay }) => (
  <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Payment transactions</caption>
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
          <tr>
            <th scope="col" className="px-6 py-4 font-semibold">Invoice / Date</th>
            <th scope="col" className="px-6 py-4 font-semibold">Service & Garage</th>
            <th scope="col" className="px-6 py-4 font-semibold">Vehicle</th>
            <th scope="col" className="px-6 py-4 font-semibold">Amount</th>
            <th scope="col" className="px-6 py-4 font-semibold">Status</th>
            <th scope="col" className="px-6 py-4 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500" role="status">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" aria-hidden="true" />
                Loading payment records...
              </td>
            </tr>
          ) : payments.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                No payment transactions found matching your criteria.
              </td>
            </tr>
          ) : (
            payments.map((p) => {
              const paying = isPaying(p.id);
              return (
                <tr key={p.id} className="hover:bg-slate-50/70 transition group">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 font-mono">{p.invoiceNumber || '—'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatDate(p.date)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{p.serviceType || 'Automotive Service'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.garageName || 'Authorized Center'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                      <Car className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
                      {p.vehicleNumber || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900 font-mono">
                    {money(p.amount)}
                    {p.totalRefundedAmount > 0 && (
                      <div className="text-[11px] font-normal text-sky-600">-{money(p.totalRefundedAmount)} refunded</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <PaymentStatusBadge status={p.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onViewInvoice(p)}
                        className="p-1.5 bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 rounded-lg transition"
                        title="View Invoice & Tax Breakdown"
                        aria-label={`View invoice ${p.invoiceNumber || ''} and tax breakdown`}
                      >
                        <FileText className="w-4 h-4" aria-hidden="true" />
                      </button>

                      {hasRefundActivity(p) && (
                        <button
                          type="button"
                          onClick={() => onTrackRefund(p)}
                          className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-medium transition flex items-center gap-1"
                          title="Track Refund Lifecycle"
                        >
                          <RefreshCw className="w-3 h-3 text-sky-600" aria-hidden="true" /> Track Refund
                        </button>
                      )}

                      {isPayable(p) && (
                        <button
                          type="button"
                          onClick={() => onPay(p)}
                          disabled={payDisabled}
                          aria-busy={paying}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {paying ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                              <span>Opening...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Pay Now</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default PaymentTransactionsTable;
