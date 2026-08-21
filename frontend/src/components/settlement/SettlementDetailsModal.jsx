import {
  X,
  IndianRupee,
  Building,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Receipt,
  FileCheck,
  ShieldCheck,
  Car
} from 'lucide-react';

const SettlementDetailsModal = ({ isOpen, onClose, settlement }) => {
  if (!isOpen || !settlement) return null;

  const isCompleted = settlement.status === 'COMPLETED';
  const isApproved = settlement.status === 'APPROVED';
  const isCancelled = settlement.status === 'CANCELLED' || settlement.status === 'FAILED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
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
            <span className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <Receipt className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">
              Settlement Payout Record
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            {settlement.settlementId}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative settlement audit trail & earnings reconciliation
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Amount and Status Banner */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Settlement Amount
              </span>
              <span className="text-2xl font-black text-slate-900 flex items-center mt-0.5">
                <IndianRupee className="h-5 w-5 mr-0.5 text-slate-400" />
                {Number(settlement.approvedAmount || settlement.requestedAmount || 0).toLocaleString('en-IN', {
                  minimumFractionDigits: 2
                })}
              </span>
            </div>

            <div>
              {isCompleted ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  COMPLETED
                </span>
              ) : isApproved ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  APPROVED
                </span>
              ) : isCancelled ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-red-700 bg-red-50 border border-red-200">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {settlement.status}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
                  <Clock className="h-3.5 w-3.5" />
                  {settlement.status || 'REQUESTED'}
                </span>
              )}
            </div>
          </div>

          {/* Details Table */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Destination Account</span>
              <span className="font-bold text-slate-800">{settlement.destinationAccountId || 'Registered Account'}</span>
            </div>

            {settlement.transferId && (
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Provider Transfer ID</span>
                <span className="font-mono font-bold text-slate-800">{settlement.transferId}</span>
              </div>
            )}

            {settlement.provider && (
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Settlement Provider</span>
                <span className="font-bold text-slate-800">{settlement.provider}</span>
              </div>
            )}

            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500 font-medium">Requested At</span>
              <span className="font-bold text-slate-800">
                {settlement.requestedAt ? new Date(settlement.requestedAt).toLocaleString('en-IN') : '—'}
              </span>
            </div>

            {settlement.completedAt && (
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Completed At</span>
                <span className="font-bold text-emerald-700">
                  {new Date(settlement.completedAt).toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {settlement.failureReason && (
              <div className="flex justify-between py-1 text-red-600">
                <span className="font-medium">Note / Reason</span>
                <span className="font-bold">{settlement.failureReason}</span>
              </div>
            )}
          </div>

          {/* Included Earnings Summary */}
          {settlement.includedEarnings && settlement.includedEarnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-slate-900">
                Included Service Earnings ({settlement.includedEarnings.length})
              </h4>
              <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
                {settlement.includedEarnings.map((e) => (
                  <div key={e.id} className="p-3 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{e.invoiceNumber}</span>
                        <span className="text-[10px] text-slate-400">({e.vehicleNumber})</span>
                      </div>
                      <div className="text-[11px] text-slate-400">{e.serviceType}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900">
                        ₹{(parseFloat(e.netAfterRefund || e.garageNetAmount) || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] font-bold text-teal-600">Net Earned</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettlementDetailsModal;
