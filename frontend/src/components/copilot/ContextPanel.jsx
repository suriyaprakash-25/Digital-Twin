import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Car, ChevronDown } from 'lucide-react';

const ContextPanel = ({ activeVehicleId, setActiveVehicleId }) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/vehicles', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          setVehicles(res.data.data);
          if (res.data.data.length > 0 && !activeVehicleId) {
            setActiveVehicleId(res.data.data[0]._id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch vehicles for context panel", err);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, [activeVehicleId, setActiveVehicleId]);

  if (loading || vehicles.length === 0) return null;

  const activeVehicle = vehicles.find(v => v._id === activeVehicleId) || vehicles[0];

  return (
    <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 relative">
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors w-full"
      >
        <Car className="w-4 h-4 text-slate-400" />
        Context: <span className="text-slate-800 font-bold">{activeVehicle.make} {activeVehicle.model}</span>
        <ChevronDown className="w-3 h-3 ml-auto" />
      </button>

      {showDropdown && (
        <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-lg rounded-b-lg z-20 py-2">
          <div className="px-3 pb-2 mb-2 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Select Context
          </div>
          {vehicles.map(v => (
            <button
              key={v._id}
              onClick={() => {
                setActiveVehicleId(v._id);
                setShowDropdown(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-blue-50 ${activeVehicleId === v._id ? 'text-blue-600 bg-blue-50/50 font-semibold' : 'text-slate-700'}`}
            >
              <Car className="w-4 h-4 opacity-50" />
              {v.make} {v.model}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContextPanel;
