import React from 'react';
import { Lightbulb, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const InsightCard = ({ data }) => {
  if (!data || !data.insights) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm w-full">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-b border-slate-100 p-4">
        <h4 className="font-bold text-slate-800 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-purple-600" />
          Vehicle Intelligence
        </h4>
        {data.iqSummary && <p className="text-xs text-slate-600 mt-1">{data.iqSummary}</p>}
      </div>
      
      <div className="p-4 space-y-3">
        {data.insights.map((insight, idx) => (
          <div key={idx} className="flex gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
              insight.trend === 'up' ? 'bg-red-100 text-red-600' : 
              insight.trend === 'down' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
            }`}>
              {insight.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : 
               insight.trend === 'down' ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
            </div>
            <div>
              <h5 className="font-bold text-sm text-slate-800">{insight.title}</h5>
              <p className="text-xs text-slate-600 mt-0.5">{insight.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InsightCard;
