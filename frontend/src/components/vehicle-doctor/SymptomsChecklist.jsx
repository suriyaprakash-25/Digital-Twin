import React from 'react';
import { Activity, Thermometer, Settings, Battery, Gauge, AlertCircle } from 'lucide-react';

const symptomCategories = [
  {
    name: 'Engine',
    icon: Activity,
    symptoms: ['Engine vibration', 'Engine overheating', 'Starting problem', 'Engine knocking']
  },
  {
    name: 'Transmission',
    icon: Settings,
    symptoms: ['Gear shifting problem', 'Clutch slipping']
  },
  {
    name: 'Brakes',
    icon: AlertCircle,
    symptoms: ['Brake noise', 'Weak braking']
  },
  {
    name: 'Tyres',
    icon: Activity,
    symptoms: ['Tyre wear', 'Low tyre pressure']
  },
  {
    name: 'Electrical',
    icon: Battery,
    symptoms: ['Battery draining', 'Lights flickering']
  },
  {
    name: 'Mileage',
    icon: Gauge,
    symptoms: ['Low mileage', 'High fuel consumption']
  },
  {
    name: 'Others',
    icon: Thermometer,
    symptoms: ['Strange smell', 'Fluid leakage', 'Suspension noise']
  }
];

const SymptomsChecklist = ({ selectedSymptoms, onToggleSymptom }) => {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-8">
      <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-teal-600" />
        Common Symptoms Checklist
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {symptomCategories.map((category) => (
          <div key={category.name} className="space-y-3">
            <h4 className="font-semibold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">
              <category.icon className="w-4 h-4 text-slate-400" />
              {category.name}
            </h4>
            <div className="space-y-2.5">
              {category.symptoms.map((symptom) => {
                const isSelected = selectedSymptoms.includes(symptom);
                return (
                  <label 
                    key={symptom} 
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSymptom(symptom)}
                        className="peer h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                    </div>
                    <span className={`text-sm select-none transition-colors ${isSelected ? 'text-teal-700 font-medium' : 'text-slate-600 group-hover:text-slate-900'}`}>
                      {symptom}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SymptomsChecklist;
