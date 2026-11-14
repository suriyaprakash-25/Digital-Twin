import { Clock, AlertTriangle, AlertCircle, CheckCircle, CheckCircle2, Loader2, XCircle, RotateCcw, ShieldX } from 'lucide-react';

// Booking / service request statuses.
export const statusMeta = {
  REQUESTED:   { label: 'Pending',     color: 'bg-amber-100 text-amber-700',    icon: <Clock className="h-3.5 w-3.5" /> },
  PENDING:     { label: 'Pending',     color: 'bg-amber-100 text-amber-700',    icon: <Clock className="h-3.5 w-3.5" /> },
  MORE_INFO_REQUIRED: { label: 'Need Info', color: 'bg-orange-100 text-orange-700', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  ACCEPTED:    { label: 'Accepted',    color: 'bg-teal-100 text-teal-700',      icon: <CheckCircle className="h-3.5 w-3.5" /> },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-violet-100 text-violet-700',  icon: <Loader2 className="h-3.5 w-3.5" /> },
  COMPLETED:   { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700',icon: <CheckCircle className="h-3.5 w-3.5" /> },
  REJECTED:    { label: 'Rejected',    color: 'bg-red-100 text-red-700',        icon: <XCircle className="h-3.5 w-3.5" /> },
};

// Payment statuses (customer, garage and admin payment tables).
export const paymentStatusMeta = {
  CAPTURED:           { label: 'Paid',           color: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  PAID:               { label: 'Paid',           color: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  PENDING:            { label: 'Pending',        color: 'bg-amber-50 text-amber-700 border-amber-200',       Icon: Clock },
  CREATED:            { label: 'Pending',        color: 'bg-amber-50 text-amber-700 border-amber-200',       Icon: Clock },
  REFUNDED:           { label: 'Refunded',       color: 'bg-violet-50 text-violet-700 border-violet-200',    Icon: RotateCcw },
  PARTIALLY_REFUNDED: { label: 'Partial Refund', color: 'bg-purple-50 text-purple-700 border-purple-200',    Icon: RotateCcw },
  FAILED:             { label: 'Failed',         color: 'bg-rose-50 text-rose-700 border-rose-200',          Icon: AlertCircle },
};

// Payment-risk event review statuses (admin).
export const riskEventStatusMeta = {
  OPEN:      { label: 'OPEN',      color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  REVIEWED:  { label: 'REVIEWED',  color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  CLEARED:   { label: 'CLEARED',   color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  ESCALATED: { label: 'ESCALATED', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
};

// Garage verification state (admin garage list), keyed by getGarageStatus().
export const garageStatusMeta = {
  SUSPENDED: { label: 'Suspended', color: 'bg-red-50 text-red-500 border-red-200',             Icon: XCircle },
  VERIFIED:  { label: 'Verified',  color: 'bg-emerald-50 text-emerald-600 border-emerald-200', Icon: CheckCircle2 },
  PENDING:   { label: 'Pending',   color: 'bg-amber-50 text-amber-600 border-amber-200',       Icon: ShieldX },
};

export function getGarageStatus(garage) {
  if (!garage?.isActive) return 'SUSPENDED';
  return garage.verified ? 'VERIFIED' : 'PENDING';
}

const FALLBACK = { color: 'bg-slate-100 text-slate-700 border-slate-200' };

/** Looks up display metadata for `status` in `metaMap`, with a neutral fallback. */
export function getStatusMeta(status, metaMap = paymentStatusMeta) {
  return metaMap[status] || { ...FALLBACK, label: status || 'Unknown' };
}
