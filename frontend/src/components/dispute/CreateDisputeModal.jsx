import { useId, useState } from 'react';
import {
  X,
  AlertTriangle,
  IndianRupee,
  Upload,
  FileText,
  Building,
  Car,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { apiUpload, getErrorMessage, idempotencyHeaders, isIdempotencyInProgress } from '../../utils/api';
import { useDialog } from '../../hooks/useDialog';
import { useIdempotencyKeys } from '../../hooks/useIdempotencyKeys';

const CATEGORIES = [
  { value: 'INCORRECT_AMOUNT', label: 'Incorrect Amount Charged' },
  { value: 'DUPLICATE_PAYMENT', label: 'Duplicate Payment / Double Charge' },
  { value: 'SERVICE_NOT_PROVIDED', label: 'Service Not Provided' },
  { value: 'POOR_SERVICE', label: 'Poor Service Quality / Defect' },
  { value: 'REFUND_NOT_RECEIVED', label: 'Refund Not Received' },
  { value: 'WRONG_REFUND_AMOUNT', label: 'Wrong Refund Amount' },
  { value: 'PAYMENT_FAILED_BUT_CHARGED', label: 'Payment Failed but Bank Debited' },
  { value: 'INVOICE_ISSUE', label: 'Invoice Itemization / Billing Issue' },
  { value: 'OTHER', label: 'Other Issue' }
];

const CreateDisputeModal = ({ isOpen, onClose, payment, onSuccess }) => {
  const [category, setCategory] = useState('INCORRECT_AMOUNT');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [disputedAmount, setDisputedAmount] = useState(payment?.amount || '');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { dialogProps, titleId } = useDialog({ isOpen: Boolean(isOpen && payment), onClose });
  const keys = useIdempotencyKeys();
  const fieldId = useId();
  const ids = {
    category: `${fieldId}-category`,
    subject: `${fieldId}-subject`,
    amount: `${fieldId}-amount`,
    amountHint: `${fieldId}-amount-hint`,
    description: `${fieldId}-description`,
    evidence: `${fieldId}-evidence`,
  };

  if (!isOpen || !payment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a detailed description of the issue');
      return;
    }

    const numAmount = parseFloat(disputedAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please provide a valid disputed amount');
      return;
    }

    if (numAmount > payment.amount) {
      setError(`Disputed amount cannot exceed the transaction total of ₹${payment.amount}`);
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    setError('');
    const scope = `dispute:${payment.id || payment.paymentId}`;

    try {
      const formData = new FormData();
      formData.append('paymentId', payment.id || payment.paymentId);
      formData.append('category', category);
      formData.append('subject', subject.trim() || `${category.replace(/_/g, ' ')} - Invoice ${payment.invoiceNumber || ''}`);
      formData.append('description', description.trim());
      formData.append('disputedAmount', numAmount);

      if (evidenceFile) {
        formData.append('evidence', evidenceFile);
      }

      const res = await apiUpload('/disputes', formData, { headers: idempotencyHeaders(keys.keyFor(scope)) });
      keys.release(scope);

      if (res?.success) {
        if (onSuccess) onSuccess(res.dispute);
        onClose();
      }
    } catch (err) {
      keys.settle(scope, err);
      setError(isIdempotencyInProgress(err)
        ? 'This dispute is already being submitted. Please wait a moment.'
        : getErrorMessage(err, 'Error submitting dispute'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        {...dialogProps}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dispute form"
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              Payment & Service Dispute
            </span>
          </div>
          <h2 id={titleId} className="text-xl font-black tracking-tight text-white">
            Raise a Payment Dispute
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Submit a formal dispute inquiry. Our support and garage team will review and resolve it.
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Payment Context Card */}
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Invoice</span>
              <span className="font-bold text-slate-800">{payment.invoiceNumber || 'DP-INV-...'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Paid Amount</span>
              <span className="font-black text-slate-900">₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Garage</span>
              <span className="font-bold text-slate-800 truncate block">{payment.garageName || 'Authorized Garage'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Vehicle</span>
              <span className="font-bold text-slate-800">{payment.vehicleNumber || 'N/A'}</span>
            </div>
          </div>

          {/* Category */}
          <div>
            <label htmlFor={ids.category} className="block text-xs font-bold text-slate-700 mb-1">
              Dispute Category *
            </label>
            <select
              id={ids.category}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor={ids.subject} className="block text-xs font-bold text-slate-700 mb-1">
              Subject Summary
            </label>
            <input
              id={ids.subject}
              type="text"
              placeholder="e.g. Overcharged for brake fluid replacement"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Disputed Amount */}
          <div>
            <label htmlFor={ids.amount} className="block text-xs font-bold text-slate-700 mb-1">
              Disputed Amount (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
              <input
                id={ids.amount}
                aria-describedby={ids.amountHint}
                type="number"
                step="0.01"
                max={payment.amount}
                required
                value={disputedAmount}
                onChange={(e) => setDisputedAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-500"
              />
            </div>
            <p id={ids.amountHint} className="text-[10px] text-slate-400 mt-0.5">Maximum refundable transaction balance: ₹{payment.amount}</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor={ids.description} className="block text-xs font-bold text-slate-700 mb-1">
              Detailed Explanation *
            </label>
            <textarea
              id={ids.description}
              rows="3"
              required
              placeholder="Explain clearly what happened and why this charge or service is being disputed..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Evidence Upload */}
          <div>
            <label htmlFor={ids.evidence} className="block text-xs font-bold text-slate-700 mb-1">
              Supporting Evidence (Optional)
            </label>
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center bg-slate-50 hover:bg-slate-100/60 transition-colors cursor-pointer relative">
              <input
                id={ids.evidence}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setEvidenceFile(e.target.files[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="h-6 w-6 text-slate-400 mx-auto mb-1" aria-hidden="true" />
              {evidenceFile ? (
                <span className="text-xs font-bold text-teal-700 block">{evidenceFile.name}</span>
              ) : (
                <>
                  <span className="text-xs font-bold text-slate-700 block">Click or drag bill / receipt photo</span>
                  <span className="text-[10px] text-slate-400">PNG, JPG, or PDF up to 10MB</span>
                </>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-60"
            >
              {submitting ? 'Submitting Dispute...' : 'Submit Dispute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDisputeModal;
