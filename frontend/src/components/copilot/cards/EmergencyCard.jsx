import React from 'react';
import { MapPin, Phone, Star, Navigation, AlertCircle } from 'lucide-react';

const EmergencyCard = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3 shadow-sm mb-2">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <p className="text-sm font-medium leading-tight">If this is a life-threatening emergency, please call 112 or your local emergency number immediately.</p>
      </div>

      {data.map((service) => (
        <div key={service.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h4 className="font-bold text-slate-800 leading-tight mb-1">{service.name}</h4>
              <div className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                {service.rating && (
                  <>
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{service.rating}</span>
                  </>
                )}
                {service.open_now && (
                  <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-2">Open Now</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-1.5 mt-3">
            <div className="flex items-start gap-2 text-slate-600">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              <span className="text-xs leading-relaxed">{service.vicinity}</span>
            </div>
            {service.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 shrink-0 text-slate-400" />
                <span className="text-xs">{service.phone}</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 rounded-lg transition-colors">
              <Phone className="w-3.5 h-3.5" /> Call
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors shadow-sm shadow-blue-500/20">
              <Navigation className="w-3.5 h-3.5" /> Navigate
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EmergencyCard;
