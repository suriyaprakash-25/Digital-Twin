import React from 'react';
import { Clock, IndianRupee, Check, Wrench } from 'lucide-react';

const ServiceCard = ({ service, onRequestClick }) => {
  if (!service) return null;

  const { title, description, price, durationMins, category, photoUrl, whatsIncluded = [], isPackage } = service;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-100 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
              {category || 'Maintenance'}
            </span>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-teal-700 transition-colors leading-tight">
              {title}
            </h3>
          </div>

          {photoUrl && (
            <img
              src={photoUrl}
              alt={title}
              className="w-14 h-14 rounded-2xl object-cover border border-slate-100 shrink-0"
            />
          )}
        </div>

        {description && (
          <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">{description}</p>
        )}

        {/* Whats Included Checklist */}
        {whatsIncluded && whatsIncluded.length > 0 && (
          <div className="space-y-1.5 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">What's Included</span>
            {whatsIncluded.slice(0, 4).map((inc, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">{inc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Price & Action */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-2">
        <div>
          <div className="flex items-center text-lg sm:text-xl font-black text-slate-900">
            <IndianRupee className="w-4 h-4 text-slate-400 mr-0.5" />
            {parseFloat(price || 0).toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold mt-0.5">
            <Clock className="w-3 h-3" /> {durationMins} mins approx
          </div>
        </div>

        <button
          onClick={() => onRequestClick(service)}
          className="py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95"
        >
          Request Service
        </button>
      </div>
    </div>
  );
};

export default ServiceCard;
