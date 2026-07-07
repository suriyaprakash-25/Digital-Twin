import React from 'react';
import { X, Bot } from 'lucide-react';

const Header = ({ onClose }) => {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white/50 backdrop-blur-md rounded-t-2xl">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-50 flex items-center justify-center border border-blue-200">
            <Bot className="w-6 h-6 text-blue-600" />
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800 leading-tight">AI CoPilot</h2>
          <p className="text-xs text-slate-500 font-medium">Your Intelligent Mobility Companion</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

export default Header;
