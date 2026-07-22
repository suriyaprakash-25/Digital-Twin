import { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 left-4 right-4 sm:top-5 sm:right-5 sm:left-auto z-[9999] flex flex-col gap-3 sm:w-full sm:max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            let Icon = Info;
            let iconColor = 'text-blue-500';
            let progressBg = 'bg-blue-500';
            let borderStyle = 'border-blue-100/80';
            let bgStyle = 'bg-white/90';

            if (toast.type === 'success') {
              Icon = CheckCircle2;
              iconColor = 'text-emerald-500';
              progressBg = 'bg-emerald-500';
              borderStyle = 'border-emerald-100/80';
            } else if (toast.type === 'error') {
              Icon = XCircle;
              iconColor = 'text-rose-500';
              progressBg = 'bg-rose-500';
              borderStyle = 'border-rose-100/80';
            } else if (toast.type === 'warning') {
              Icon = AlertCircle;
              iconColor = 'text-amber-500';
              progressBg = 'bg-amber-500';
              borderStyle = 'border-amber-100/80';
            }

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }}
                layout
                className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 p-4 rounded-2xl border ${borderStyle} ${bgStyle} backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.08)]`}
              >
                <div className="shrink-0 mt-0.5">
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                
                <div className="flex-1 text-sm font-bold text-slate-800 pr-4 leading-relaxed">
                  {toast.message}
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  className="shrink-0 p-0.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Animated active progress bar */}
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: toast.duration / 1000, ease: 'linear' }}
                  className={`absolute bottom-0 left-0 h-1 ${progressBg}`}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
