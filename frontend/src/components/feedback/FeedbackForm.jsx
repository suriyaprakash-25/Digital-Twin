import React, { useState } from 'react';
import axios from 'axios';
import {
  Send,
  Loader2,
  Tag,
  MessageSquare,
  Compass,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import StarRating from './StarRating';
import ScreenshotUploader from './ScreenshotUploader';

const CATEGORIES = [
  'General Feedback',
  'Bug Report',
  'Feature Request',
  'UI / Design',
  'Performance Issue',
  'Garage Experience',
  'Vehicle Management',
  'Vehicle Passport',
  'Marketplace',
  'Service Experience',
  'Other'
];

const FeedbackForm = ({
  currentPage = { pageUrl: '/', pageName: 'DrivePortz App' },
  onSuccess
}) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role') || 'USER';
  const userName = localStorage.getItem('name') || '';

  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('General Feedback');
  const [message, setMessage] = useState('');
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [touchedRating, setTouchedRating] = useState(false);

  const charCount = message.length;
  const isMessageValid = charCount >= 10 && charCount <= 1000;
  const isFormValid = rating >= 1 && rating <= 5 && Boolean(category) && isMessageValid;

  const handleScreenshotChange = (file, previewUrl) => {
    setScreenshotFile(file);
    setScreenshotPreview(previewUrl);
  };

  const handleScreenshotRemove = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouchedRating(true);
    setErrorMsg('');

    if (!rating || rating < 1) {
      setErrorMsg('Please select a star rating (1 to 5).');
      return;
    }

    if (!isMessageValid) {
      setErrorMsg('Please provide a message between 10 and 1000 characters.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('rating', String(rating));
      formData.append('category', category);
      formData.append('message', message.trim());
      formData.append('pageUrl', currentPage.pageUrl || window.location.pathname);
      formData.append('pageName', currentPage.pageName || document.title || 'DrivePortz App');

      if (screenshotFile) {
        formData.append('screenshot', screenshotFile);
      }

      const headers = {
        'Content-Type': 'multipart/form-data'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await axios.post(`${apiUrl}/api/feedback`, formData, { headers });

      if (res.data && res.data.success) {
        onSuccess(res.data.feedback);
      } else {
        setErrorMsg(res.data?.msg || 'Failed to submit feedback. Please try again.');
      }
    } catch (err) {
      console.error('Feedback submit error:', err);
      setErrorMsg(
        err.response?.data?.msg ||
        err.message ||
        'An error occurred while submitting your feedback. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Current Page Context Badge */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600 truncate">
          <Compass className="h-3.5 w-3.5 text-teal-600 shrink-0" />
          <span className="text-slate-400 font-medium shrink-0">Feedback on:</span>
          <span className="font-bold text-slate-800 truncate">{currentPage.pageName}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
          {currentPage.pageUrl}
        </span>
      </div>

      {/* User Information Chip (if logged in) */}
      {userName && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 px-1">
          <UserCheck className="h-3 w-3 text-teal-600 shrink-0" />
          <span>Submitting as <strong className="text-slate-700 font-semibold">{userName}</strong> ({userRole})</span>
        </div>
      )}

      {/* Rating Field */}
      <div className="space-y-1 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <label className="text-xs font-bold text-slate-800 block">
          How would you rate your experience? <span className="text-red-500">*</span>
        </label>
        <StarRating
          value={rating}
          onChange={(val) => {
            setRating(val);
            setTouchedRating(false);
            if (errorMsg.includes('rating')) setErrorMsg('');
          }}
          disabled={submitting}
          error={touchedRating && (!rating || rating < 1)}
        />
      </div>

      {/* Category Dropdown */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-teal-600" />
          Feedback Category <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={submitting}
            className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all cursor-pointer"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
            ▼
          </div>
        </div>
      </div>

      {/* Feedback Message */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-teal-600" />
            Tell us what you think... <span className="text-red-500">*</span>
          </label>
          <span
            className={`text-[11px] font-mono ${
              charCount > 1000
                ? 'text-red-600 font-bold'
                : charCount >= 10
                ? 'text-teal-600 font-semibold'
                : 'text-slate-400'
            }`}
          >
            {charCount} / 1000
          </span>
        </div>

        <textarea
          rows={4}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (errorMsg.includes('characters')) setErrorMsg('');
          }}
          disabled={submitting}
          placeholder="Describe your experience, suggestion, problem, or idea..."
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none font-medium leading-relaxed"
        />
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Minimum 10 characters</span>
          {charCount > 0 && charCount < 10 && (
            <span className="text-amber-600 font-medium">Need {10 - charCount} more character(s)</span>
          )}
        </div>
      </div>

      {/* Optional Screenshot Upload */}
      <ScreenshotUploader
        file={screenshotFile}
        previewUrl={screenshotPreview}
        onChange={handleScreenshotChange}
        onRemove={handleScreenshotRemove}
        disabled={submitting}
      />

      {/* Error Message */}
      {errorMsg && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting || !isFormValid}
          className="w-full py-3 px-5 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs md:text-sm shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Submit Feedback</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default FeedbackForm;
