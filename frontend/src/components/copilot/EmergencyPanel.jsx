import React, { useState } from 'react';
import { AlertTriangle, MapPin, X, Loader2 } from 'lucide-react';
import axios from 'axios';

const categories = [
  "Flat Tyre", 
  "Vehicle Breakdown", 
  "Dead Battery", 
  "Fuel Finished", 
  "Accident", 
  "Other Emergency"
];

const EmergencyPanel = ({ onClose, onEmergencySent }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCategorySelect = async (category) => {
    setLoading(true);
    setError(null);
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.post('http://localhost:5000/api/copilot/emergency', {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            category: category,
            radius: 5000 // default 5km
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.data.success) {
            onEmergencySent(res.data.data, category);
          }
        } catch (err) {
          console.error("Emergency API error:", err);
          setError("Failed to fetch nearby services. Please try again.");
        } finally {
          setLoading(false);
        }
      },
      (geoErr) => {
        console.error("Geolocation error:", geoErr);
        setError("Please allow location access to find nearby help.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="absolute inset-0 bg-white/95 backdrop-blur-xl z-50 flex flex-col p-6 overflow-y-auto animate-in slide-in-from-bottom-full duration-300">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6" />
          Emergency Assistance
        </h3>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
          <X className="w-5 h-5" />
        </button>
      </div>

      <p className="text-sm text-slate-600 mb-6">
        Select your emergency to find immediate nearby assistance. We will use your location to find the closest help.
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-red-100 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-red-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
          </div>
          <p className="text-red-600 font-medium flex items-center gap-2 animate-pulse">
            <MapPin className="w-4 h-4" /> Locating you...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              className="bg-white border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 text-slate-700 hover:text-red-700 p-4 rounded-xl text-sm font-semibold transition-all shadow-sm text-center flex flex-col items-center justify-center gap-2 min-h-[100px]"
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmergencyPanel;
