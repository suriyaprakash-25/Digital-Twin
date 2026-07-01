import React from 'react';
import { MapPin, Phone, Star, ShieldCheck } from 'lucide-react';

const GarageCard = ({ data }) => {
  return (
    <div className="flex flex-col gap-3 w-full">
      {data.map((garage) => (
        <div key={garage._id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-slate-800">{garage.name}</h4>
                {garage.isVerified && <ShieldCheck className="w-4 h-4 text-blue-500" title="Verified Garage" />}
              </div>
              <div className="flex items-center gap-1 text-xs text-amber-500 font-medium mb-2">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{garage.rating || 4.5}</span>
                <span className="text-slate-400 font-normal">({garage.reviews || 0} reviews)</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-1.5 mt-2">
            <div className="flex items-start gap-2 text-slate-600">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              <span className="text-xs">{garage.address}, {garage.city}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-4 h-4 shrink-0 text-slate-400" />
              <span className="text-xs">{garage.contactNumber}</span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold py-2 rounded-lg transition-colors">
              Book Appointment
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GarageCard;
