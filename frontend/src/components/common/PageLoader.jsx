import { Loader2 } from 'lucide-react';

/** Suspense / page-level loading fallback. Polite live region so it is announced once. */
const PageLoader = ({ label = 'Loading page…', fullScreen = false }) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex items-center justify-center gap-3 text-slate-500 ${fullScreen ? 'min-h-screen bg-slate-50' : 'min-h-[40vh]'}`}
  >
    <Loader2 className="h-6 w-6 animate-spin text-teal-600" aria-hidden="true" />
    <span className="text-sm font-semibold">{label}</span>
  </div>
);

export default PageLoader;
