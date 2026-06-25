import React from 'react';

const ConfidenceBar = ({ confidence }) => {
  const getProgressColor = () => {
    if (confidence >= 80) return 'bg-teal-500';
    if (confidence >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500 font-medium">Confidence Score</span>
        <span className="text-slate-700 font-bold">{confidence}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div 
          className={`h-1.5 rounded-full transition-all duration-1000 ${getProgressColor()}`} 
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  );
};

export default ConfidenceBar;
