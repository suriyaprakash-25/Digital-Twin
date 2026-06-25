import React from 'react';

const UrgencyBadge = ({ level }) => {
  const getStyles = () => {
    switch (level?.toLowerCase()) {
      case 'low':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStyles()}`}>
      Urgency: {level || 'Unknown'}
    </span>
  );
};

export default UrgencyBadge;
