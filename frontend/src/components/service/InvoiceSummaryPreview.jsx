import { FileText, IndianRupee } from 'lucide-react';
import { formatRupees } from './serviceFormat';

const Row = ({ label, value, className = 'flex justify-between text-slate-300' }) => (
  <div className={className}>
    <span>{label}</span>
    <span className="font-mono">{value}</span>
  </div>
);

/** Step 6 (completion mode): live GST invoice preview from the computed totals. */
const InvoiceSummaryPreview = ({ totals }) => (
  <section aria-label="Invoice summary preview" className="bg-slate-900 text-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl">
    <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
      <div className="flex items-center gap-2.5">
        <FileText className="h-5 w-5 text-teal-400" aria-hidden="true" />
        <h3 className="text-base md:text-lg font-bold text-white">Invoice Summary Preview</h3>
      </div>
      <span className="text-xs font-bold text-teal-400 bg-teal-950/80 px-2.5 py-1 rounded-full border border-teal-800">
        18% GST Applicable
      </span>
    </div>

    <div className="space-y-2.5 text-xs md:text-sm font-medium">
      <Row label="Parts Subtotal" value={formatRupees(totals.partsSubtotal)} />
      <Row label="Labour Subtotal" value={formatRupees(totals.labourSubtotal)} />
      {totals.additionalSubtotal > 0 && <Row label="Additional Charges" value={formatRupees(totals.additionalSubtotal)} />}
      <Row label="Gross Subtotal" value={formatRupees(totals.subtotal)} className="flex justify-between font-bold text-slate-200 border-t border-slate-800 pt-2" />
      {totals.discount > 0 && (
        <Row label="Discount" value={`-${formatRupees(totals.discount)}`} className="flex justify-between text-emerald-400 font-bold" />
      )}
      <Row label="Taxable Amount" value={formatRupees(totals.taxableAmount)} />
      <Row label={<>&bull; CGST (9.0%)</>} value={formatRupees(totals.cgstAmount)} className="flex justify-between text-slate-400 text-xs pl-2" />
      <Row label={<>&bull; SGST (9.0%)</>} value={formatRupees(totals.sgstAmount)} className="flex justify-between text-slate-400 text-xs pl-2" />
    </div>

    <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
      <div>
        <span className="text-xs uppercase font-extrabold text-teal-400 tracking-wider block">Authoritative Grand Total</span>
        <span className="text-[11px] text-slate-400">Calculated server-side in integer paise</span>
      </div>
      <div className="text-2xl md:text-4xl font-black text-white font-mono flex items-center">
        <IndianRupee className="h-6 w-6 md:h-8 md:w-8 text-teal-400" aria-hidden="true" />
        {totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </div>
    </div>
  </section>
);

export default InvoiceSummaryPreview;
