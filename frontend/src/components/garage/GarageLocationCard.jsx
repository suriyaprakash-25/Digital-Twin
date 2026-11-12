import { useState } from 'react';
import { MapPin, Navigation, X } from 'lucide-react';
import GarageLocationPicker from '../GarageLocationPicker';

/** Shows the pinned garage location and toggles the map picker. */
const GarageLocationCard = ({ location, onLocationSaved }) => {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl shadow-sm overflow-hidden mt-6">
      <div className="px-4 py-3 md:px-8 md:py-5 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-teal-100 rounded-xl text-teal-600"><MapPin className="h-4 w-4 md:h-5 md:w-5" /></div>
          <div>
            <h2 className="text-sm md:text-lg font-extrabold text-slate-900">Garage Location</h2>
            <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5">
              {location
                ? `Pinned: ${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`
                : 'No location set yet'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 w-full sm:w-auto justify-end">
          {location && !showPicker && (
            <a
              href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] md:text-xs font-bold hover:bg-emerald-100 transition-all"
            >
              <Navigation className="h-3 w-3 md:h-3.5 md:w-3.5" /> View on Maps
            </a>
          )}
          {showPicker ? (
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl border border-slate-200 bg-white text-slate-650 text-[10px] md:text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
            >
              <X className="h-3 w-3 md:h-3.5 md:w-3.5" /> Close Map
            </button>
          ) : (
            <button
              type="button"
              aria-expanded={showPicker}
              onClick={() => setShowPicker(true)}
              className="inline-flex items-center gap-1 px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-teal-600 text-white text-xs md:text-sm font-bold hover:bg-teal-700 transition-all shadow-sm"
            >
              <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4" />
              {location ? 'Edit Location' : 'Add Garage Location'}
            </button>
          )}
        </div>
      </div>

      {showPicker && (
        <div className="p-4 md:p-6 border-t border-slate-100">
          <GarageLocationPicker
            initialLocation={location}
            onSaved={(coords) => {
              onLocationSaved(coords);
              setTimeout(() => setShowPicker(false), 1200);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default GarageLocationCard;
