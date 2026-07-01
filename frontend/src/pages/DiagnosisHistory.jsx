import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, ArrowLeft, Calendar, Car } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UrgencyBadge from '../components/vehicle-doctor/UrgencyBadge';
import DiagnosisCard from '../components/vehicle-doctor/DiagnosisCard';

const DiagnosisHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/vehicle-doctor/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHistory(res.data);
      } catch (err) {
        console.error('Failed to fetch history', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/vehicle-doctor')}
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 rounded-full border border-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-teal-600" />
            Diagnosis History
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
          <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-teal-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Past Diagnoses</h3>
          <p className="text-slate-500 mb-6">You haven't requested any AI diagnostics yet.</p>
          <button 
            onClick={() => navigate('/vehicle-doctor')}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-colors"
          >
            Start a Diagnosis
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((record) => {
            const isSelected = selectedDiagnosis?._id === record._id;
            return (
              <div key={record._id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all">
                <div 
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setSelectedDiagnosis(isSelected ? null : record)}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Car className="w-4 h-4 text-slate-400" />
                        {record.vehicleDetails ? `${record.vehicleDetails.brand} ${record.vehicleDetails.model}` : 'Unknown Vehicle'}
                      </span>
                      <UrgencyBadge level={record.aiResponse?.urgency} />
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(record.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                      })}
                    </div>
                  </div>
                  
                  <div className="text-sm text-slate-600 truncate max-w-sm">
                    {record.symptoms || (record.selectedSymptoms && record.selectedSymptoms.join(', '))}
                  </div>
                </div>

                {/* Expanded Details */}
                {isSelected && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-2">
                    <DiagnosisCard diagnosis={record} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DiagnosisHistory;
