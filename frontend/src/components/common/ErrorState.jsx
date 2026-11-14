import { AlertTriangle, RefreshCw } from 'lucide-react';

/** Inline error panel with an optional Retry action. Announced to screen readers. */
const ErrorState = ({ message, onRetry, retrying = false, title = 'Something went wrong', className = '' }) => (
  <div
    role="alert"
    className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 ${className}`}
  >
    <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" aria-hidden="true" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold">{title}</p>
      {message && <p className="text-sm text-rose-700 break-words">{message}</p>}
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={() => onRetry()}
        disabled={retrying}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    )}
  </div>
);

export default ErrorState;
