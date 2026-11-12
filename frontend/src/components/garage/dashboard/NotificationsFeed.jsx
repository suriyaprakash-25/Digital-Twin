import { useMemo } from 'react';
import { Bell } from 'lucide-react';

/** Recent notifications, de-duplicated by title + body. */
const NotificationsFeed = ({ notifications }) => {
  const deduped = useMemo(() => {
    const seen = new Set();
    return notifications.filter(n => {
      const key = `${n.title}|${n.body}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [notifications]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
        <div className="p-2 bg-amber-100 rounded-xl text-amber-600"><Bell className="h-5 w-5" /></div>
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Recent Notifications</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Latest activity on your garage</p>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {deduped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-10 w-10 text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium text-sm">No notifications yet.</p>
          </div>
        ) : (
          deduped.slice(0, 8).map(n => (
            <div key={n.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
              <div className="text-sm font-bold text-slate-900">{n.title}</div>
              {n.body && <div className="text-sm text-slate-500 mt-0.5">{n.body}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsFeed;
