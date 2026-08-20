import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Heart, Sparkles } from 'lucide-react';

const FeedbackSuccess = ({ onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="py-8 px-4 text-center flex flex-col items-center justify-center space-y-4"
    >
      <div className="relative">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/25 text-white"
        >
          <Heart className="h-10 w-10 fill-white drop-shadow-sm animate-pulse" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, rotate: -20 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ delay: 0.2 }}
          className="absolute -top-1 -right-1 p-1.5 bg-amber-400 text-amber-950 rounded-full shadow-md"
        >
          <Sparkles className="h-4 w-4 fill-amber-950" />
        </motion.div>
      </div>

      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-xl font-black text-slate-900 tracking-tight">
          Thank you for your feedback! ❤️
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          Your feedback helps us continuously improve DrivePortz and build a better experience for everyone.
        </p>
      </div>

      <div className="pt-3 w-full max-w-xs">
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
        >
          Done
        </button>
      </div>
    </motion.div>
  );
};

export default FeedbackSuccess;
