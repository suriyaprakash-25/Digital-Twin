import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CalendarClock, Activity, AlertCircle, Save, Clock, CheckCircle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const GarageAvailabilityCard = ({ garageId, token }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [availabilityMode, setAvailabilityMode] = useState('AUTO');
  const [manualStatus, setManualStatus] = useState('CLOSED');
  const [currentStatus, setCurrentStatus] = useState('CLOSED');
  
  // Default business hours state
  const [businessHours, setBusinessHours] = useState(
    DAYS.reduce((acc, day) => ({
      ...acc,
      [day]: { isOpen: true, openTime: '09:00', closeTime: '19:00' }
    }), {})
  );

  useEffect(() => {
    if (garageId && token) {
      fetchAvailability();
    }
  }, [garageId, token]);

  const fetchAvailability = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garage/availability/${garageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.data;
      setAvailabilityMode(data.availabilityMode || 'AUTO');
      setManualStatus(data.manualStatus || 'CLOSED');
      setCurrentStatus(data.currentStatus || 'CLOSED');
      if (data.businessHours) {
        setBusinessHours(data.businessHours);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching availability:', err);
      setLoading(false);
    }
  };

  const saveAvailability = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        availabilityMode,
        manualStatus,
        businessHours
      };
      
      const res = await axios.patch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garage/availability`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCurrentStatus(res.data.currentStatus);
      setSuccess('Availability updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to update availability');
    } finally {
      setSaving(false);
    }
  };

  const handleHourChange = (day, field, value) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  if (loading) {
    return <div className="p-6 bg-white rounded-3xl shadow-sm border border-slate-200 animate-pulse h-64 flex items-center justify-center">Loading availability config...</div>;
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl">
            <CalendarClock className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Smart Availability</h2>
            <p className="text-xs text-slate-500 font-medium">Control your garage's real-time marketplace status</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 font-bold text-sm border
          ${currentStatus === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
            currentStatus === 'BUSY' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
            'bg-slate-50 text-slate-600 border-slate-200'}`}
        >
          {currentStatus === 'AVAILABLE' && <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>}
          {currentStatus === 'BUSY' && <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>}
          {currentStatus === 'CLOSED' && <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>}
          {currentStatus === 'AVAILABLE' ? 'Open Now' : currentStatus === 'BUSY' ? 'Busy' : 'Closed'}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm font-medium flex items-center gap-2"><AlertCircle size={16}/> {error}</div>}
      {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium flex items-center gap-2"><CheckCircle size={16}/> {success}</div>}

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setAvailabilityMode('AUTO')}
          className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2
          ${availabilityMode === 'AUTO' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
        >
          <Clock className={`h-6 w-6 ${availabilityMode === 'AUTO' ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span className={`font-bold ${availabilityMode === 'AUTO' ? 'text-indigo-900' : 'text-slate-600'}`}>Automatic Mode</span>
          <span className="text-xs text-slate-500 text-center">Uses your business hours</span>
        </button>

        <button 
          onClick={() => setAvailabilityMode('MANUAL')}
          className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2
          ${availabilityMode === 'MANUAL' ? 'border-teal-600 bg-teal-50/50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
        >
          <Activity className={`h-6 w-6 ${availabilityMode === 'MANUAL' ? 'text-teal-600' : 'text-slate-400'}`} />
          <span className={`font-bold ${availabilityMode === 'MANUAL' ? 'text-teal-900' : 'text-slate-600'}`}>Manual Override</span>
          <span className="text-xs text-slate-500 text-center">Set status instantly</span>
        </button>
      </div>

      {availabilityMode === 'MANUAL' && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Manual Status Selection</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            {['AVAILABLE', 'BUSY', 'CLOSED'].map(status => (
              <button
                key={status}
                onClick={() => setManualStatus(status)}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm border transition-all
                  ${manualStatus === status && status === 'AVAILABLE' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' :
                    manualStatus === status && status === 'BUSY' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' :
                    manualStatus === status && status === 'CLOSED' ? 'bg-slate-700 text-white border-slate-800 shadow-sm' :
                    'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {status === 'AVAILABLE' ? '🟢 Available' : status === 'BUSY' ? '🟡 Busy' : '⚫ Closed'}
              </button>
            ))}
          </div>
        </div>
      )}

      {availabilityMode === 'AUTO' && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Weekly Business Hours</h3>
          <div className="space-y-3">
            {DAYS.map(day => (
              <div key={day} className="flex items-center gap-4 p-3 bg-white rounded-xl border border-slate-200">
                <div className="w-28 font-semibold text-slate-700 text-sm">{day}</div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={businessHours[day]?.isOpen}
                    onChange={(e) => handleHourChange(day, 'isOpen', e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <label className="text-sm text-slate-600 cursor-pointer" onClick={() => handleHourChange(day, 'isOpen', !businessHours[day]?.isOpen)}>Open</label>
                </div>
                
                {businessHours[day]?.isOpen ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <input 
                      type="time" 
                      value={businessHours[day]?.openTime || ''}
                      onChange={(e) => handleHourChange(day, 'openTime', e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700 focus:outline-none focus:border-indigo-400"
                    />
                    <span className="text-slate-400 text-sm">to</span>
                    <input 
                      type="time" 
                      value={businessHours[day]?.closeTime || ''}
                      onChange={(e) => handleHourChange(day, 'closeTime', e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                ) : (
                  <div className="ml-auto text-sm font-medium text-slate-400 px-4 py-1 bg-slate-50 rounded-md border border-slate-100">Closed Entire Day</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button 
        onClick={saveAvailability}
        disabled={saving}
        className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
      >
        {saving ? <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin"/> : <Save size={18} />}
        Save Availability Settings
      </button>

    </div>
  );
};

export default GarageAvailabilityCard;
