import React from 'react';
import { Wrench, CheckCircle2, Clock } from 'lucide-react';

const ServiceTimeline = ({ data }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm w-full">
      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Wrench className="w-5 h-5 text-blue-600" />
        Service History
      </h4>
      
      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
        {data.map((service, index) => (
          <div key={service._id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white bg-blue-100 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              <CheckCircle2 className="w-3 h-3 text-blue-600" />
            </div>
            <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-slate-100 bg-slate-50 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-slate-800">{service.serviceType || 'Maintenance'}</span>
                <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(service.serviceDate).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2 mb-2 line-clamp-2">
                {service.serviceCategory || 'Standard service completed.'}
              </p>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-[10px] text-slate-400">Cost</span>
                <span className="text-xs font-bold text-slate-700">₹{service.totalCost || '0'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServiceTimeline;
