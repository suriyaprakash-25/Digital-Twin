import { Bug, Clock, MessageSquare, Sparkles, Star } from 'lucide-react';

const MetricCard = ({ label, children, iconWrapClass, icon }) => (
  <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
    <div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      {children}
    </div>
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconWrapClass}`} aria-hidden="true">
      {icon}
    </div>
  </div>
);

/** KPI summary row for the admin feedback page. */
const FeedbackMetrics = ({ metrics }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
    <MetricCard label="Total Feedback" iconWrapClass="bg-slate-100 text-slate-700" icon={<MessageSquare className="h-5 w-5" />}>
      <p className="text-2xl font-black text-slate-900 mt-1">{metrics.totalFeedback}</p>
    </MetricCard>

    <MetricCard label="Avg Rating" iconWrapClass="bg-amber-50 text-amber-500" icon={<Star className="h-5 w-5 fill-amber-400" />}>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-2xl font-black text-amber-600">{metrics.averageRating || '0.0'}</span>
        <span className="text-xs text-slate-500 font-bold">/ 5.0</span>
      </div>
    </MetricCard>

    <MetricCard label="New Unreviewed" iconWrapClass="bg-emerald-50 text-emerald-600" icon={<Clock className="h-5 w-5" />}>
      <p className="text-2xl font-black text-emerald-600 mt-1">{metrics.newFeedback}</p>
    </MetricCard>

    <MetricCard label="Bug Reports" iconWrapClass="bg-rose-50 text-rose-600" icon={<Bug className="h-5 w-5" />}>
      <p className="text-2xl font-black text-rose-600 mt-1">{metrics.bugReports}</p>
    </MetricCard>

    <MetricCard label="Feature Requests" iconWrapClass="bg-indigo-50 text-indigo-600" icon={<Sparkles className="h-5 w-5" />}>
      <p className="text-2xl font-black text-indigo-600 mt-1">{metrics.featureRequests}</p>
    </MetricCard>
  </div>
);

export default FeedbackMetrics;
