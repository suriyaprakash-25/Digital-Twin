import React from 'react';
import { Bot, MessageSquare } from 'lucide-react';

const FloatingButton = ({ onClick, isOpen }) => {
  return (
    <div className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-50 group">
      {/* Tooltip */}
      {!isOpen && (
        <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap shadow-lg shadow-slate-900/10">
          Ask DrivePortz CoPilot
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}

      {/* Button */}
      <button
        onClick={onClick}
        className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 ${
          isOpen
            ? 'bg-slate-800 hover:bg-slate-700 shadow-slate-800/30'
            : 'bg-gradient-to-tr from-blue-600 to-indigo-500 hover:scale-105 shadow-blue-500/40 hover:shadow-blue-500/50'
        }`}
      >
        {/* Pulse effect */}
        {!isOpen && (
          <div className="absolute inset-0 rounded-full border-2 border-blue-400 opacity-0 animate-ping"></div>
        )}

        <div className="text-white">
          {isOpen ? <MessageSquare className="w-6 h-6" /> : <Bot className="w-7 h-7" />}
        </div>
      </button>
    </div>
  );
};

export default FloatingButton;
