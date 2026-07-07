import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Stethoscope, FileText, Camera, Loader2, ArrowRight } from 'lucide-react';
import VehicleSelector from '../components/vehicle-doctor/VehicleSelector';
import SymptomsChecklist from '../components/vehicle-doctor/SymptomsChecklist';
import DiagnosisCard from '../components/vehicle-doctor/DiagnosisCard';
import { useNavigate } from 'react-router-dom';

const VehicleDoctor = () => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/vehicles/myvehicles`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setVehicles(res.data);
      } catch (err) {
        console.error('Failed to fetch vehicles', err);
      }
    };
    fetchVehicles();
  }, []);

  const handleToggleSymptom = (symptom) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVehicleId) {
      setError('Please select a vehicle.');
      return;
    }
    if (!symptoms && selectedSymptoms.length === 0) {
      setError('Please describe your symptoms or select from the checklist.');
      return;
    }

    setError('');
    setLoading(true);
    setDiagnosisResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('vehicleId', selectedVehicleId);
      formData.append('symptoms', symptoms);
      formData.append('selectedSymptoms', JSON.stringify(selectedSymptoms));
      
      images.forEach((image) => {
        formData.append('images', image);
      });

      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/vehicle-doctor/analyze`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setDiagnosisResult(res.data);
    } catch (err) {
      console.error('Diagnosis Failed:', err);
      setError(err.response?.data?.msg || 'Failed to analyze vehicle. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up pb-12 lg:pb-8">
      {/* Header Area */}
      <div className="bg-gradient-to-r from-teal-900 to-slate-900 rounded-3xl p-8 md:p-12 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between">
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
          <Stethoscope className="w-64 h-64" />
        </div>
        <div className="relative z-10 max-w-2xl">

          <h1 className="text-4xl font-extrabold mb-4">AI Vehicle Doctor</h1>
          <p className="text-teal-100/80 text-lg leading-relaxed">
            Describe your vehicle's symptoms and get an instant AI-powered preliminary diagnosis, repair cost estimate, and recommendations.
          </p>
        </div>
        <div className="relative z-10 mt-6 md:mt-0">
          <button 
            onClick={() => navigate('/vehicle-doctor/history')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-colors font-medium"
          >
            <FileText className="w-5 h-5" />
            Diagnosis History
          </button>
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl text-amber-800 text-sm flex gap-3 shadow-sm">
        <Stethoscope className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <strong className="font-bold block mb-1">Medical Disclaimer</strong>
          This AI diagnosis is for informational purposes only and should not replace a professional mechanical inspection. Always consult a certified mechanic before making repair decisions.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <VehicleSelector 
          vehicles={vehicles} 
          selectedVehicleId={selectedVehicleId} 
          onChange={setSelectedVehicleId} 
        />

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            Describe the Problem
          </h3>
          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="E.g., I hear a knocking sound from the engine when I accelerate..."
            className="w-full h-32 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-900 placeholder-slate-400 transition-all resize-none"
          ></textarea>
        </div>

        <SymptomsChecklist 
          selectedSymptoms={selectedSymptoms} 
          onToggleSymptom={handleToggleSymptom} 
        />

        {/* Optional Image Upload */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-600" />
            Upload Images (Optional)
          </h3>
          <p className="text-sm text-slate-500 mb-4">Have a picture of a warning light, leak, or damaged part? Upload it here.</p>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2.5 file:px-4
              file:rounded-xl file:border-0
              file:text-sm file:font-semibold
              file:bg-teal-50 file:text-teal-700
              hover:file:bg-teal-100 transition-colors"
          />
          {images.length > 0 && (
            <div className="mt-4 text-sm text-teal-600 font-medium">{images.length} file(s) selected</div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="group relative flex items-center justify-center gap-2 px-8 py-4 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 w-full md:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Vehicle Data...
              </>
            ) : (
              <>
                Generate AI Diagnosis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>

      {diagnosisResult && (
        <div id="diagnosis-result">
          <DiagnosisCard diagnosis={diagnosisResult} />
        </div>
      )}
    </div>
  );
};

export default VehicleDoctor;
