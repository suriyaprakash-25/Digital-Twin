import React from 'react';
import { AlertTriangle, Wrench, ShieldCheck, MapPin } from 'lucide-react';
import UrgencyBadge from './UrgencyBadge';
import ConfidenceBar from './ConfidenceBar';
import { useNavigate } from 'react-router-dom';

const DiagnosisCard = ({ diagnosis }) => {
  const navigate = useNavigate();

  if (!diagnosis || !diagnosis.aiResponse) return null;

  const { possibleCauses, urgency, estimatedRepairCost, recommendedAction, preventiveTips } = diagnosis.aiResponse;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-8 animate-fade-in-up">
      <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-teal-400" />
          AI Diagnostic Results
        </h3>
        <UrgencyBadge level={urgency} />
      </div>

      <div className="p-6 md:p-8 space-y-8">
        
        {/* Possible Causes Section */}
        <div>
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Top Possible Causes
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {possibleCauses && possibleCauses.map((cause, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <div className="font-semibold text-slate-800 text-sm mb-2">{cause.name}</div>
                <ConfidenceBar confidence={cause.confidence} />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Estimated Cost & Action */}
          <div className="space-y-6">
            <div className="bg-teal-50 border border-teal-100 p-5 rounded-2xl">
              <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-1">Estimated Repair Cost</h4>
              <div className="text-2xl font-extrabold text-teal-600">{estimatedRepairCost || 'N/A'}</div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Recommended Action</h4>
              <div className="text-sm font-medium text-amber-900 leading-relaxed">{recommendedAction || 'Seek professional inspection.'}</div>
            </div>
          </div>

          {/* Preventive Tips */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-teal-600" />
              Preventive Tips
            </h4>
            <ul className="space-y-2">
              {preventiveTips && preventiveTips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-teal-500 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Call to Action */}
        <div className="pt-4 border-t border-slate-100">
          <button 
            onClick={() => navigate('/marketplace')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-teal-600 text-white font-bold rounded-xl transition-colors shadow-sm"
          >
            <MapPin className="w-4 h-4" />
            Find Nearby Garage
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagnosisCard;
