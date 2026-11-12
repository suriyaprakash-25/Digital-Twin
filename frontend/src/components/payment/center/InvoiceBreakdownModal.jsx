import { CreditCard, FileText, Loader2, Printer, X } from 'lucide-react';
import { PaymentStatusBadge } from '../../common/StatusBadge';
import { useDialog } from '../../../hooks/useDialog';
import { isPayable } from './paymentFilterUtils';
import { formatDate } from '../../../utils/format';

const GST_RATE = 0.18;

function taxBreakdown(amount) {
  const total = Number(amount || 0);
  const base = total / (1 + GST_RATE);
  const gst = total - base;
  return { total, base, gst, half: gst / 2 };
}

/** Tax invoice preview for one payment row, with print and Pay Now. */
const InvoiceBreakdownModal = ({ invoice, onClose, onPay, paying, payDisabled }) => {
  const { dialogProps, titleId } = useDialog({ isOpen: Boolean(invoice), onClose });
  if (!invoice) return null;

  const { total, base, gst, half } = taxBreakdown(invoice.amount);
  const garageGstin = invoice.garageGstin || invoice.gstin || invoice.garageGSTIN || null;
  const gatewayRef = invoice.paymentId || invoice.cashfreePaymentId || invoice.cfOrderId || invoice.orderId || '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div {...dialogProps} className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden print:m-0 print:border-none print:shadow-none focus:outline-none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 border border-teal-200 rounded-xl text-teal-600">
              <FileText className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900">Tax Invoice</h2>
              <p className="text-xs text-slate-500 font-mono">{invoice.invoiceNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start pb-4 border-b border-slate-100">
            <div>
              <p className="text-lg font-bold text-teal-600">DrivePortz Mobility Twin</p>
              <p className="text-xs text-slate-500 mt-0.5">Automotive Service Partner Network</p>
            </div>
            <div className="text-right text-xs">
              <span className="text-slate-500">Invoice Date:</span>
              <p className="font-semibold text-slate-900 mt-0.5">{formatDate(invoice.date, undefined)}</p>
              <span className="text-slate-500 mt-2 block">Payment Status:</span>
              <div className="mt-0.5"><PaymentStatusBadge status={invoice.status} /></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
            <div>
              <span className="text-slate-500 uppercase tracking-wider font-semibold">Billed To</span>
              <p className="text-slate-900 font-medium mt-1">Valued Customer</p>
              <p className="text-slate-500">Vehicle: <span className="font-mono text-teal-700 font-bold">{invoice.vehicleNumber || '—'}</span></p>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider font-semibold">Service Provider</span>
              <p className="text-slate-900 font-medium mt-1">{invoice.garageName || 'Authorized Workshop'}</p>
              {garageGstin && <p className="text-slate-500">GSTIN: <span className="font-mono text-slate-700">{garageGstin}</span></p>}
              <p className="text-slate-500">Payment Ref: <span className="font-mono text-slate-700">{gatewayRef}</span></p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-semibold">
                <tr>
                  <th scope="col" className="p-3">Description</th>
                  <th scope="col" className="p-3 text-right">Taxable Amount</th>
                  <th scope="col" className="p-3 text-right">GST (18%)</th>
                  <th scope="col" className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 text-slate-800">{invoice.serviceType || 'Standard Automotive Service & Inspection'}</td>
                  <td className="p-3 text-right text-slate-700 font-mono">₹{base.toFixed(2)}</td>
                  <td className="p-3 text-right text-slate-500 font-mono">₹{gst.toFixed(2)}</td>
                  <td className="p-3 text-right font-bold text-slate-900 font-mono">₹{total.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Taxable Base Value:</span>
              <span className="font-mono text-slate-700">₹{base.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>CGST (9.0%):</span>
              <span className="font-mono text-slate-700">₹{half.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>SGST (9.0%):</span>
              <span className="font-mono text-slate-700">₹{half.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold pt-2 border-t border-slate-200 text-sm">
              <span>Grand Total:</span>
              <span className="font-metric text-metric-md text-teal-600">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
          >
            Close
          </button>
          {isPayable(invoice) && (
            <button
              type="button"
              onClick={() => onPay(invoice)}
              disabled={payDisabled}
              aria-busy={paying}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-sm font-bold transition shadow-sm disabled:opacity-60"
            >
              {paying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Opening Checkout...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" aria-hidden="true" />
                  <span>Pay ₹{total.toLocaleString('en-IN')}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceBreakdownModal;
