import { Phone, MessageSquare, CheckCircle, XCircle, AlertTriangle, PlayCircle, CheckCircle2, User, Loader2 } from 'lucide-react';
import MediaManager from '../../MediaManager';
import { statusMeta } from '../../../utils/statusMeta';

const formatDateTime = (value) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

const BookingCard = ({ booking: b, garageName, pendingBookingId, onUpdateStatus, onReject, onRequestInfo, onComplete }) => {
  const meta = statusMeta[b.status] || { label: b.status, color: 'bg-slate-100 text-slate-600', icon: null };
  const cleanPhone = b.customer?.phone ? String(b.customer.phone).replace(/\D/g, '') : '';
  const isPending = pendingBookingId === b.id;
  const busy = Boolean(pendingBookingId);
  const userMessages = (b.timeline || []).filter(t => t.by === 'USER' && t.message);
  const spinner = isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null;

  return (
    <div className="p-5 hover:bg-slate-50 transition-colors" aria-busy={isPending}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="space-y-1">
          <div className="text-sm font-extrabold text-slate-900 flex flex-wrap items-center gap-2">
            <span>{b.service?.title || 'General Service'}</span>
            <span className="text-slate-300">&bull;</span>
            <span className="font-semibold text-slate-700">{b.vehicle?.brand} {b.vehicle?.model}</span>
            <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded font-bold">{b.vehicle?.vehicleNumber || 'Reg: N/A'}</span>
          </div>

          {/* Customer Info & Tap-to-Call / WhatsApp */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1 font-medium">
            <span className="flex items-center gap-1 font-bold text-slate-800">
              <User className="h-3.5 w-3.5 text-teal-600" /> {b.customer?.name || 'Customer'}
            </span>
            {b.customer?.phone && (
              <a href={`tel:${b.customer.phone}`} className="inline-flex items-center gap-1 text-teal-600 font-bold hover:underline">
                <Phone className="h-3 w-3" /> {b.customer.phone}
              </a>
            )}
            {cleanPhone && (
              <a
                href={`https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodeURIComponent(`Hi ${b.customer?.name || 'Customer'}, regarding your booking for ${b.service?.title || 'service'} at ${garageName || 'our garage'}...`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-600 font-bold hover:underline"
              >
                <MessageSquare className="h-3 w-3" /> WhatsApp
              </a>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium pt-0.5">
            Scheduled: <span className="font-bold text-slate-700">{b.scheduledFor ? formatDateTime(b.scheduledFor) : 'Not set'}</span>
          </div>
          {b.notes && <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 max-w-lg mt-1">Notes: {b.notes}</div>}

          {b.isCustomIssue && b.service?.issueDetails && (
            <div className="mt-3 p-3 bg-orange-50 border border-orange-100 rounded-xl max-w-2xl">
              <h4 className="text-xs font-black text-orange-800 mb-2 uppercase tracking-wide">Reported Issue Details</h4>
              <div className="space-y-1.5">
                <div className="text-sm text-orange-900"><span className="font-semibold">Description:</span> {b.service.issueDetails.description}</div>
                <div className="text-xs text-orange-800"><span className="font-semibold">Started:</span> {b.service.issueDetails.duration}</div>
                <div className="text-xs text-orange-800"><span className="font-semibold">Impact:</span> {b.service.issueDetails.urgency}</div>
              </div>
              {userMessages.length > 0 && (
                <div className="mt-3 pt-3 border-t border-orange-200">
                  <h4 className="text-[10px] font-black text-orange-800 mb-1.5 uppercase tracking-wide">Additional Info Provided</h4>
                  <div className="space-y-1.5">
                    {userMessages.map((t, idx) => (
                      <div key={idx} className="text-sm text-orange-900 bg-orange-100/50 p-2.5 rounded-lg border border-orange-200/50">
                        &quot;{t.message}&quot;
                        <div className="text-[10px] font-semibold text-orange-700/70 mt-1">{formatDateTime(t.at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-2">
            <MediaManager entityId={b.id} entityType="BOOKING" category={b.isCustomIssue ? 'CUSTOMER_ISSUE' : 'CUSTOMER_DAMAGE'} label={b.isCustomIssue ? 'Vehicle Issue Photos' : 'Customer Damage Photos'} readOnly={true} />
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${meta.color}`}>
          {meta.icon} {meta.label}
        </span>
      </div>

      {/* Context-aware Single Next Action Button */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100/60 mt-3">
        {(b.status === 'PENDING' || b.status === 'REQUESTED') && (
          <>
            <button
              type="button"
              onClick={() => onUpdateStatus(b.id, 'ACCEPTED')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {spinner || <CheckCircle className="h-3.5 w-3.5" />} Accept Booking
            </button>
            {b.isCustomIssue && (
              <button
                type="button"
                onClick={() => onRequestInfo(b.id)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold hover:bg-orange-100 border border-orange-200 transition-colors shadow-sm disabled:opacity-60"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Request Info
              </button>
            )}
            <button
              type="button"
              onClick={() => onReject(b)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
          </>
        )}

        {b.status === 'ACCEPTED' && (
          <button
            type="button"
            onClick={() => onUpdateStatus(b.id, 'IN_PROGRESS')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {spinner || <PlayCircle className="h-3.5 w-3.5" />} Start Job
          </button>
        )}

        {b.status === 'IN_PROGRESS' && (
          <button
            type="button"
            onClick={() => onComplete(b)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
          </button>
        )}

        {(b.status === 'COMPLETED' || b.status === 'REJECTED') && (
          <span className="text-xs font-bold text-slate-400 italic">No further action needed</span>
        )}
      </div>
    </div>
  );
};

export default BookingCard;
