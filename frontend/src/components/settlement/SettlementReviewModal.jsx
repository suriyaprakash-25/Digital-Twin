import React, { useState } from 'react';
import axios from 'axios';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Building2,
  CreditCard,
  ArrowRight,
  RotateCcw,
  Ban,
  UserCheck
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import SettlementHoldModal from './SettlementHoldModal';

export default function SettlementReviewModal({ settlement, onClose, onUpdated }) {
  const { showSuccess, showError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!settlement) return null;

  const reqAmount = parseFloat(settlement.approvedAmount || settlement.requestedAmount) || 0;
  const isHighValue = settlement.isHighValue || reqAmount >= 50000;
  const requiredApprovals = settlement.requiredApprovalCount || (isHighValue ? 2 : 1);
  const currentApprovals = settlement.approvalCount || (settlement.approvals ? settlement.approvals.length : 0);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const endpoint = isHighValue && currentApprovals === 1
        ? `${API_BASE_URL}/admin/settlements/${settlement.settlementId || settlement._id}/second-approve`
        : `${API_BASE_URL}/admin/settlements/${settlement.settlementId || settlement._id}/approve`;

      const res = await axios.post(endpoint, { confirmation: true }, { headers: getAuthHeaders() });
      if (res.data?.success) {
        showSuccess(res.data.message || 'Settlement approved');
        if (onUpdated) onUpdated();
        onClose();
      } else {
        showError(res.data?.message || 'Failed to approve');
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Error approving settlement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showError('Please specify the reason for rejection');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/admin/settlements/${settlement.settlementId || settlement._id}/reject`,
        { reason: rejectReason.trim(), confirmation: true },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        showSuccess('Settlement rejected and earnings unlocked');
        if (onUpdated) onUpdated();
        onClose();
      } else {
        showError(res.data?.message || 'Failed to reject');
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Error rejecting settlement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcess = async () => {
    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/admin/settlements/${settlement.settlementId || settlement._id}/process`,
        { confirmation: true },
        { headers: getAuthHeaders() }
      );
      if (res.data?.success) {
        showSuccess('Settlement payout processed successfully (TEST MODE)');
        if (onUpdated) onUpdated();
        onClose();
      } else {
        showError(res.data?.message || 'Failed to process payout');
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Error processing payout');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden p-6 md:p-8 space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Settlement Review</span>
                {isHighValue && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-900/60 text-purple-300 border border-purple-700">
                    HIGH-VALUE (DUAL APPROVAL)
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-white mt-0.5">{settlement.settlementId}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Garage & Account Info */}
          <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block">Beneficiary Partner</span>
              <strong className="text-white text-sm">{settlement.garageName || settlement.garageId}</strong>
              <p className="text-slate-500 mt-1">Requested by: {settlement.requestedBy || 'Garage Admin'}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block">Bank Account Destination</span>
              <strong className="text-white text-sm">
                {settlement.payoutProfile?.bankAccountLast4 ? `•••• •••• ${settlement.payoutProfile.bankAccountLast4}` : 'Default Payout Account'}
              </strong>
              <p className="text-slate-500 mt-1">IFSC: {settlement.payoutProfile?.ifscMasked || 'Verified'}</p>
            </div>
          </div>

          {/* Amount Summary */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Payout Amount</span>
              <div className="text-2xl font-black text-cyan-400">
                ₹{reqAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Current Status</span>
              <div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  settlement.status === 'SETTLED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  settlement.status === 'APPROVED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  settlement.status === 'UNDER_REVIEW' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {settlement.status}
                </span>
              </div>
            </div>
          </div>

          {/* Maker-Checker & Approvals Checklist */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
            <span className="font-bold text-slate-300 block">Maker-Checker Governance Status</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                currentApprovals >= 1 ? 'bg-emerald-950/20 border-emerald-800 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                {currentApprovals >= 1 ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Clock className="w-4 h-4 text-slate-500 shrink-0" />}
                <div>
                  <strong className="block text-white">Approval 1 (Finance Admin)</strong>
                  <span className="text-[11px] text-slate-400">
                    {settlement.approvals?.[0] ? `Approved by ${settlement.approvals[0].adminId}` : 'Pending first approval'}
                  </span>
                </div>
              </div>

              {isHighValue && (
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                  currentApprovals >= 2 ? 'bg-emerald-950/20 border-emerald-800 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  {currentApprovals >= 2 ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Clock className="w-4 h-4 text-slate-500 shrink-0" />}
                  <div>
                    <strong className="block text-white">Approval 2 (Second Admin)</strong>
                    <span className="text-[11px] text-slate-400">
                      {settlement.approvals?.[1] ? `Approved by ${settlement.approvals[1].adminId}` : 'Pending second approval'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reject Input */}
          {showRejectInput && (
            <div className="bg-red-950/30 border border-red-800/40 p-4 rounded-2xl space-y-3 text-xs">
              <label className="font-bold text-red-300 block">Rejection Justification</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this settlement request is rejected..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectInput(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg"
                >
                  {isSubmitting ? 'Rejecting...' : 'Confirm Reject & Unlock'}
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHoldModal(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                Place Hold
              </button>
              {!showRejectInput && (
                <button
                  onClick={() => setShowRejectInput(true)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Reject
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {currentApprovals < requiredApprovals && (
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                >
                  <UserCheck className="w-4 h-4" />
                  {isHighValue && currentApprovals === 1 ? 'Record Second Approval' : 'Approve Settlement'}
                </button>
              )}

              {(currentApprovals >= requiredApprovals || settlement.status === 'APPROVED') && settlement.status !== 'SETTLED' && (
                <button
                  onClick={handleProcess}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <CreditCard className="w-4 h-4" />
                  {isSubmitting ? 'Processing Payout...' : 'Process Payout (TEST MODE)'}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {showHoldModal && (
        <SettlementHoldModal
          settlement={settlement}
          onClose={() => setShowHoldModal(false)}
          onUpdated={() => {
            if (onUpdated) onUpdated();
            onClose();
          }}
        />
      )}
    </>
  );
}
