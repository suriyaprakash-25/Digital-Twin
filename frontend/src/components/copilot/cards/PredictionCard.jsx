import React from 'react';
import { Gauge, Clock, Wrench } from 'lucide-react';

const PredictionCard = ({ data }) => {
  if (!data || !data.predictions) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm w-full">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-100 p-4">
        <h4 className="font-bold text-slate-800 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-indigo-600" />
          Predictive Maintenance
        </h4>
        {data.summary && <p className="text-xs text-slate-600 mt-1">{data.summary}</p>}
      </div>
      
      <div className="p-4 space-y-3">
        {data.predictions.map((pred, idx) => (
          <div key={idx} className="border border-slate-100 rounded-lg p-3">
            <div className="flex justify-between items-start mb-2">
              <h5 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-slate-400" /> {pred.component}
              </h5>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                pred.urgency === 'High' ? 'bg-red-100 text-red-700' :
                pred.urgency === 'Medium' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {pred.urgency}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mb-2 text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-flex">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">Due in {pred.estimatedTime}</span>
            </div>
            
            <p className="text-xs text-slate-600">{pred.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PredictionCard;
