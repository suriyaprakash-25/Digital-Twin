import { useState } from 'react';
import {
  X,
  IndianRupee,
  Building,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ArrowRight,
  Wallet
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';

const RequestSettlementModal = ({ isOpen, onClose, availableBalance = 0, payoutProfile, onSuccess }) => {
  if (!isOpen) return null;

  const minAmount = 500;
  const [amount, setAmount] = useState(availableBalance > 0 ? String(availableBalance) : '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount >= minAmount && numAmount <= availableBalance;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/garage/settlements/request`,
        { amount: numAmount, notes },
        { headers: getAuthHeaders() }
      );

      if (res.data?.success) {
        if (onSuccess) onSuccess(res.data.settlement);
        onClose();
      }
    } catch (err) {
      console.error('Settlement request failed:', err);
      setError(err.response?.data?.message || 'Failed to submit settlement request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              Payout Withdrawal
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            Request Settlement
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Transfer verified service earnings to your registered garage account
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Available Balance Banner */}
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Available for Settlement
              </span>
              <span className="text-xl font-black text-emerald-900 flex items-center mt-0.5">
                <IndianRupee className="h-4 w-4 mr-0.5" />
                {availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAmount(String(availableBalance))}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              Withdraw Full
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Withdrawal Amount (₹)</label>
            <div className="relative">
              <IndianRupee className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                step="1"
                min={minAmount}
                max={availableBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter payout amount"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-teal-500"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Minimum settlement amount: ₹{minAmount.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Bank Destination Profile */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Payout Destination
            </span>
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span>{payoutProfile?.bankName || 'Registered Garage Bank'}</span>
              <span className="font-mono text-slate-600">
                {payoutProfile?.bankAccountLast4 ? `**** **** ${payoutProfile.bankAccountLast4}` : 'Default Payout Account'}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Settlement Note (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Weekly payout request"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              {loading ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <span>Submit Request</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestSettlementModal;
