import React from 'react';
import { Car, ShieldAlert, Activity } from 'lucide-react';

const VehicleSelector = ({ vehicles, selectedVehicleId, onChange }) => {
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-8">
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Car className="w-5 h-5 text-teal-600" />
        Select Vehicle to Diagnose
      </h3>
      
      <div className="relative">
        <select
          value={selectedVehicleId}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-teal-500 focus:border-teal-500 block p-3.5 pr-10 font-medium cursor-pointer"
        >
          <option value="">-- Select a Vehicle --</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.brand} {v.model} ({v.vehicleNumber})
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
      </div>

      {selectedVehicle && (
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-teal-50/50 rounded-xl border border-teal-100">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Make & Model</div>
            <div className="font-bold text-slate-900">{selectedVehicle.brand} {selectedVehicle.model}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Year</div>
            <div className="font-bold text-slate-900">{selectedVehicle.year || 'N/A'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mileage</div>
            <div className="font-bold text-slate-900">{selectedVehicle.mileage ? `${selectedVehicle.mileage.toLocaleString()} km` : 'N/A'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Activity className="w-3 h-3 text-teal-600" /> IQ Score
            </div>
            <div className="font-bold text-teal-700">
              {selectedVehicle.healthScore || 85} <span className="text-sm font-medium text-teal-600/70">/ 100</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleSelector;
