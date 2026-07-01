import React from 'react';
import { Shield, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';

const InsuranceCard = ({ data }) => {
  return (
    <div className="flex flex-col gap-3 w-full">
      {data.map((insurance) => {
        const isExpired = new Date(insurance.expiryDate) < new Date();
        
        return (
          <div key={insurance._id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${isExpired ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpired ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  <Shield className={`w-5 h-5 ${isExpired ? 'text-red-600' : 'text-emerald-600'}`} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{insurance.provider}</h4>
                  <p className="text-xs text-slate-500">{insurance.policyNumber}</p>
                </div>
              </div>
              {isExpired ? (
                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> Expired
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  <CheckCircle className="w-3 h-3" /> Active
                </span>
              )}
            </div>
            
            <div className="bg-slate-50 rounded-lg p-3 flex justify-between items-center mt-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-600 font-medium">Valid until</span>
              </div>
              <span className={`text-sm font-bold ${isExpired ? 'text-red-600' : 'text-slate-800'}`}>
                {new Date(insurance.expiryDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InsuranceCard;
