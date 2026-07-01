import React from 'react';
import { Shield, FileText, Car, Wrench, AlertTriangle, Clock, Lightbulb, Gauge } from 'lucide-react';

const actions = [
  { id: 1, text: "My Vehicles",       message: "show my vehicles",            icon: Car,          color: "text-blue-600",    bg: "bg-blue-50" },
  { id: 2, text: "Vehicle Passport",   message: "vehicle passport",            icon: FileText,     color: "text-indigo-600",  bg: "bg-indigo-50" },
  { id: 3, text: "Emergency Help",     message: null, action: "OPEN_EMERGENCY",icon: AlertTriangle,color: "text-red-600",     bg: "bg-red-50" },
  { id: 4, text: "Nearby Garages",     message: "show me nearby garages",      icon: Wrench,       color: "text-amber-600",   bg: "bg-amber-50" },
  { id: 5, text: "Service History",    message: "show my service history",     icon: Clock,        color: "text-slate-600",   bg: "bg-slate-50" },
  { id: 6, text: "Insurance",         message: "show my insurance",           icon: Shield,       color: "text-purple-600",  bg: "bg-purple-50" },
  { id: 7, text: "Vehicle Insights",  message: "give me vehicle insights",    icon: Lightbulb,    color: "text-rose-600",    bg: "bg-rose-50" },
  { id: 8, text: "Next Service",      message: "predict my upcoming maintenance", icon: Gauge,    color: "text-emerald-600", bg: "bg-emerald-50" },
];

const QuickActions = ({ onSelectAction }) => {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider px-2">Quick Actions</p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => {
                if (action.action === 'OPEN_EMERGENCY') {
                  onSelectAction('__OPEN_EMERGENCY__');
                } else {
                  onSelectAction(action.message);
                }
              }}
              className="flex items-center gap-3 p-3 text-left bg-white border border-slate-100 hover:border-blue-200 hover:shadow-sm rounded-xl transition-all group"
            >
              <div className={`p-2 rounded-lg ${action.bg} group-hover:scale-110 transition-transform shrink-0`}>
                <Icon className={`w-4 h-4 ${action.color}`} />
              </div>
              <span className="text-xs font-medium text-slate-700 leading-tight">
                {action.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActions;
