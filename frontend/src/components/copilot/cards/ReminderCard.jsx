import React from 'react';
import { CalendarClock, AlertCircle } from 'lucide-react';

const ReminderCard = ({ data }) => {
  if (!data || !data.reminders) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm w-full">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-slate-100 p-4">
        <h4 className="font-bold text-slate-800 flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-amber-600" />
          Active Reminders
        </h4>
      </div>
      
      <div className="p-4 space-y-3">
        {data.reminders.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-2">No active reminders.</p>
        ) : (
          data.reminders.map((rem, idx) => (
            <div key={idx} className="flex items-start gap-3 bg-white border border-slate-100 shadow-sm p-3 rounded-lg relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${rem.priority === 'High' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
              <div className={`mt-0.5 ${rem.priority === 'High' ? 'text-red-500' : 'text-amber-500'}`}>
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h5 className="font-bold text-sm text-slate-800">{rem.type}</h5>
                <p className="text-xs font-medium text-slate-600 mt-0.5">Due: {rem.dueDate}</p>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-bold ${rem.priority === 'High' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                {rem.daysLeft} days left
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReminderCard;
