import React from 'react';
import { Car, CheckCircle, Gauge, Hash, Fuel, Calendar } from 'lucide-react';

const VehicleCard = ({ data }) => {
  return (
    <div className="flex flex-col gap-3 w-full">
      {data.map((vehicle) => (
        <div key={vehicle._id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                <Car className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800">{vehicle.brand || vehicle.make} {vehicle.model}</h4>
                <p className="text-xs text-slate-500">{vehicle.variant} • {vehicle.vehicleNumber || vehicle.registrationNumber}</p>
              </div>
            </div>
            {vehicle.verificationStatus === 'Verified' && (
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Odometer</p>
                <p className="text-xs font-bold text-slate-700">{vehicle.currentOdometerKm || vehicle.currentMileage || 'N/A'} km</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Fuel</p>
                <p className="text-xs font-bold text-slate-700">{vehicle.fuelType || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Year</p>
                <p className="text-xs font-bold text-slate-700">{vehicle.manufacturingYear || vehicle.year || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Chassis</p>
                <p className="text-xs font-bold text-slate-700 truncate">{vehicle.chassisNumber || vehicle.vin || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default VehicleCard;
