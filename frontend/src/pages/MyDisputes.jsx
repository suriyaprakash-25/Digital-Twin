import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGetPage, apiPost, getErrorMessage } from '../utils/api';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../context/toastContextCore';
import ErrorState from '../components/common/ErrorState';
import StatusBadge from '../components/common/StatusBadge';
import { formatCurrency } from '../utils/format';

const PAGE_SIZE = 20;
const CANCELLABLE = new Set(['OPEN', 'WAITING_FOR_USER']);

const disputeStatusMeta = {
  OPEN: { label: 'Open', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  WAITING_FOR_USER: { label: 'Awaiting your reply', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  WAITING_FOR_GARAGE: { label: 'Awaiting garage', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  UNDER_REVIEW: { label: 'Under review', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  RESOLVED: { label: 'Resolved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Cancelled', color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/** Vehicle owner's list of payment disputes (GET /api/disputes). */
const MyDisputes = () => {
  const { showSuccess, showError } = useToast();
  const [page, setPage] = useState(1);
  const [cancellingId, setCancellingId] = useState(null);

  const { data, error, loading, refreshing, refetch } = useAsync(
    () => apiGetPage('/disputes', { page, limit: PAGE_SIZE }),
    [page],
  );

  const disputes = data?.data?.disputes || [];
  const totalPages = data?.totalPages || data?.data?.totalPages || 1;

  const handleCancel = async (dispute) => {
    if (cancellingId) return;
    if (!window.confirm(`Cancel dispute ${dispute.disputeNumber}? This cannot be undone.`)) return;
    setCancellingId(dispute.id);
    try {
      const res = await apiPost(`/disputes/${dispute.id}/cancel`);
      showSuccess(res?.message || 'Dispute cancelled');
      refetch({ silent: true });
    } catch (err) {
      showError(getErrorMessage(err, 'Could not cancel the dispute'));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden="true" /> My Disputes
          </h1>
          <p className="text-sm text-slate-500">Track disputes you have raised on payments. Raise a new one from your <Link className="font-semibold text-teal-700 underline" to="/payment-history">payment history</Link>.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch({ silent: true })}
          disabled={loading || refreshing}
          className="self-start inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => refetch()} retrying={loading} />}

      {loading && !data ? (
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /> Loading disputes…
        </div>
      ) : !error && disputes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          You have not raised any disputes.
        </div>
      ) : (
        <ul className="space-y-3">
          {disputes.map((d) => (
            <li key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400">{d.disputeNumber} · {formatDate(d.date)}</p>
                  <p className="font-bold text-slate-900 break-words">{d.subject || d.category || 'Payment dispute'}</p>
                  <p className="text-sm text-slate-500">
                    {[d.garageName, d.serviceType, d.vehicleNumber, d.invoiceNumber].filter(Boolean).join(' · ')}
                  </p>
                  {d.resolution && (
                    <p className="mt-1 text-sm text-slate-600">
                      Resolution: {typeof d.resolution === 'string' ? d.resolution : d.resolution.note || d.resolution.type || ''}
                    </p>
                  )}
                </div>
                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                  <StatusBadge status={d.status} metaMap={disputeStatusMeta} />
                  {Number(d.disputedAmount) > 0 && <span className="text-sm font-bold text-slate-800">{formatCurrency(d.disputedAmount)}</span>}
                  {CANCELLABLE.has(d.status) && (
                    <button
                      type="button"
                      onClick={() => handleCancel(d)}
                      disabled={cancellingId === d.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                    >
                      {cancellingId === d.id && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                      Cancel dispute
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="Dispute pages" className="flex items-center justify-center gap-3">
          <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="text-sm font-semibold text-slate-600">Page {page} of {totalPages}</span>
          <button type="button" aria-label="Next page" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
};

export default MyDisputes;
