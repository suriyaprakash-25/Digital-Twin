import React from 'react';
import { Activity, AlertTriangle, PenTool, Lightbulb, MapPin } from 'lucide-react';

const DiagnosisCard = ({ data }) => {
  if (!data) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm w-full">
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-slate-100 p-4">
        <h4 className="font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-5 h-5 text-red-600" />
          AI Diagnosis Report
        </h4>
      </div>
      
      <div className="p-4 space-y-4">
        <div>
          <h5 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-2">Possible Causes</h5>
          <div className="space-y-3">
            {data.possibleCauses?.map((cause, idx) => (
              <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="flex justify-between items-start mb-1">
                  <h6 className="font-semibold text-slate-700 text-sm">{cause.title || cause.name}</h6>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{cause.confidence}% Match</span>
                </div>
                <p className="text-xs text-slate-600">{cause.description}</p>
                <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${cause.confidence}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Urgency</span>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className={`w-4 h-4 ${data.urgency === 'High' ? 'text-red-500' : data.urgency === 'Medium' ? 'text-orange-500' : 'text-emerald-500'}`} />
              <span className={`text-sm font-bold ${data.urgency === 'High' ? 'text-red-700' : data.urgency === 'Medium' ? 'text-orange-700' : 'text-emerald-700'}`}>
                {data.urgency || 'Medium'}
              </span>
            </div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Est. Cost</span>
            <div className="flex items-center gap-1.5">
              <PenTool className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-bold text-slate-700">{data.estimatedRepairCost || 'Varies'}</span>
            </div>
          </div>
        </div>

        {data.recommendedAction && (
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
            <h5 className="text-xs uppercase font-bold text-blue-600 tracking-wider mb-1 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> Recommended Action
            </h5>
            <p className="text-xs text-blue-800 font-medium">{data.recommendedAction}</p>
          </div>
        )}

        <button className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
          <MapPin className="w-4 h-4" /> Find Nearby Garages
        </button>
      </div>
    </div>
  );
};

export default DiagnosisCard;
