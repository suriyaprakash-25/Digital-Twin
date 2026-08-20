import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquareHeart } from 'lucide-react';
import FeedbackForm from './FeedbackForm';
import FeedbackSuccess from './FeedbackSuccess';

const FeedbackModal = ({ isOpen, onClose, currentPage }) => {
  const [submitted, setSubmitted] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset submitted state when modal is closed/reopened
  useEffect(() => {
    if (isOpen) {
      setSubmitted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 my-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-modal-title"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-xs shrink-0">
                <MessageSquareHeart className="h-5 w-5" />
              </div>
              <div>
                <h2 id="feedback-modal-title" className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Share Your Feedback
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Help us improve DrivePortz.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {submitted ? (
              <FeedbackSuccess onClose={onClose} />
            ) : (
              <FeedbackForm
                currentPage={currentPage}
                onSuccess={() => setSubmitted(true)}
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default FeedbackModal;
