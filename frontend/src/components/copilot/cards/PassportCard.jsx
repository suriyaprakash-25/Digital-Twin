import React from 'react';
import { FileText, Shield, Gauge, Fuel, Hash, Calendar, User, MapPin, AlertCircle, CheckCircle } from 'lucide-react';

const PassportCard = ({ data }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  const isExpired = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {data.map((vehicle) => (
        <div key={vehicle._id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">{vehicle.brand || vehicle.make} {vehicle.model} {vehicle.variant}</h4>
                <p className="text-indigo-200 text-xs">{vehicle.vehicleNumber} • {vehicle.vehicleType}</p>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Key Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 p-2 rounded-lg text-center">
                <Gauge className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Odometer</p>
                <p className="text-xs font-bold text-slate-800">{vehicle.currentOdometerKm || 0} km</p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg text-center">
                <Fuel className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Fuel</p>
                <p className="text-xs font-bold text-slate-800">{vehicle.fuelType || 'N/A'}</p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg text-center">
                <Calendar className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Year</p>
                <p className="text-xs font-bold text-slate-800">{vehicle.manufacturingYear || 'N/A'}</p>
              </div>
            </div>

            {/* Owner Info */}
            <div className="border border-slate-100 rounded-lg p-3">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Owner Details</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium">{vehicle.ownerName}</span>
                  <span className="text-slate-400">({vehicle.ownershipCount} owner)</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{vehicle.registeredRTO}</span>
                </div>
              </div>
            </div>

            {/* Chassis & Engine */}
            <div className="border border-slate-100 rounded-lg p-3">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Identification</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1"><Hash className="w-3 h-3" /> Chassis</span>
                  <span className="font-mono text-slate-700 text-[10px]">{vehicle.chassisNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1"><Hash className="w-3 h-3" /> Engine</span>
                  <span className="font-mono text-slate-700 text-[10px]">{vehicle.engineNumber || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Expiry Dates */}
            <div className="border border-slate-100 rounded-lg p-3">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Validity & Renewals</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Insurance', date: vehicle.insuranceExpiry },
                  { label: 'PUC', date: vehicle.pucExpiry },
                  { label: 'RC Validity', date: vehicle.rcExpiry },
                  { label: 'Road Tax', date: vehicle.roadTaxValidTill },
                ].map(({ label, date }) => (
                  <div key={label} className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 flex items-center gap-1">
                      {isExpired(date) ? <AlertCircle className="w-3 h-3 text-red-500" /> : <CheckCircle className="w-3 h-3 text-emerald-500" />}
                      {label}
                    </span>
                    <span className={`font-medium text-[11px] ${isExpired(date) ? 'text-red-600' : date ? 'text-slate-700' : 'text-slate-400'}`}>
                      {formatDate(date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PassportCard;
