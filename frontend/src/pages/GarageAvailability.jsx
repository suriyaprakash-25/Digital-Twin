import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Clock } from 'lucide-react';
import GarageAvailabilityCard from '../components/garage/GarageAvailabilityCard';

const GarageAvailability = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/garages/me`, headers)
      .then(res => {
        if (res.data?.exists) {
          setProfile(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [headers]);

  if (loading) {
    return <div className="p-12 text-center text-slate-500 font-medium">Loading availability settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 lg:pb-8 animate-in fade-in duration-500">
      {/* Back */}
      <button
        onClick={() => navigate('/garage-dashboard')}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-6 group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      {/* Hero banner */}
      <div className="relative rounded-2xl md:rounded-3xl overflow-hidden mb-8 bg-gradient-to-br from-indigo-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.25),transparent_60%)]" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <Clock className="h-6 w-6 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-extrabold text-white tracking-tight">Smart Availability</h1>
            <p className="text-slate-300 mt-1 text-sm font-medium">Manage your marketplace status and weekly business hours.</p>
          </div>
        </div>
      </div>

      {!profile?.id ? (
        <div className="p-6 bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl font-semibold">
          You need to create your Garage Profile first before configuring availability.
        </div>
      ) : (
        <GarageAvailabilityCard garageId={profile.id} token={token} />
      )}
    </div>
  );
};

export default GarageAvailability;
