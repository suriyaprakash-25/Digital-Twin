import { useId, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { apiPut, getErrorMessage, idempotencyHeaders, isIdempotencyInProgress } from '../../utils/api';
import { useDialog } from '../../hooks/useDialog';
import { useIdempotencyKeys } from '../../hooks/useIdempotencyKeys';
import { useToast } from '../../context/toastContextCore';

const SCOPE = 'payout-profile-save';
const EMPTY_FORM = { accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '' };

const FIELDS = [
  { name: 'accountHolderName', label: 'Account Holder Name', placeholder: 'e.g. Apex Auto Services', extra: '' },
  { name: 'bankName', label: 'Bank Name', placeholder: 'e.g. HDFC Bank', extra: '' },
  { name: 'accountNumber', label: 'Account Number', placeholder: 'e.g. 50100492817291', extra: 'font-mono' },
  { name: 'ifscCode', label: 'IFSC Code', placeholder: 'e.g. HDFC0001234', extra: 'font-mono uppercase' },
];

/** Bank account used for garage payouts (PUT /garage/payout-profile). */
const PayoutProfileModal = ({ onClose, onSaved }) => {
  const [bankForm, setBankForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { dialogProps, titleId } = useDialog({ isOpen: true, onClose });
  const idempotencyKeys = useIdempotencyKeys();
  const { showError, showWarning } = useToast();
  const fieldId = useId();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const key = idempotencyKeys.keyFor(SCOPE);
    try {
      const data = await apiPut('/garage/payout-profile', bankForm, { headers: idempotencyHeaders(key) });
      idempotencyKeys.release(SCOPE);
      if (data?.success) onSaved(data.profile);
    } catch (err) {
      idempotencyKeys.settle(SCOPE, err);
      if (isIdempotencyInProgress(err)) showWarning('Your payout profile update is already being processed.');
      else showError(getErrorMessage(err, 'Error saving payout profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div {...dialogProps} className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden p-6 space-y-4 focus:outline-none">
        <div className="flex items-center justify-between">
          <h3 id={titleId} className="text-base font-black text-slate-900">Garage Bank Account for Payouts</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {FIELDS.map((f) => (
            <div key={f.name}>
              <label htmlFor={`${fieldId}-${f.name}`} className="font-bold text-slate-700 block mb-1">{f.label}</label>
              <input
                id={`${fieldId}-${f.name}`}
                type="text"
                required
                placeholder={f.placeholder}
                value={bankForm[f.name]}
                onChange={(e) => setBankForm({ ...bankForm, [f.name]: e.target.value })}
                className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl ${f.extra}`}
              />
            </div>
          ))}

          <div className="pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md disabled:opacity-70"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {saving ? 'Saving...' : 'Save Bank Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayoutProfileModal;
